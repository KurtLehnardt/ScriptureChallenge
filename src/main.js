import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    signInAnonymously,
    signInWithCustomToken,
    onAuthStateChanged,
    GoogleAuthProvider,
    FacebookAuthProvider,
    signInWithPopup,
    signOut
} from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

import scriptureJSON from './scripture_texts.json';

// Define an object to build the structured data for display
const SCRIPTURE_DATA = {}; // This will be populated on component load

// Helper function to parse scripture reference text (e.g., "Luke 1:26–38")
const parseScriptureReference = (text) => {
    // Regex to handle various formats like "Luke 1:26–38", "1 Pet. 2:5", "3 Ne. 9:20", "D&C 59:8"
    // It captures:
    // 1. Book Name (e.g., "Luke", "1 Pet.", "3 Ne.", "D&C") - non-greedy match to handle spaces
    // 2. Chapter Number (e.g., "1", "2", "9", "59")
    // 3. Optional Verse Range (e.g., ":26–38", ":5", ":20", ":8")
    const match = text.match(/^([\w\s&.]+?)\s*(\d+)(:\d+(?:–\d+)?)?$/);

    if (!match) {
        console.warn("Could not parse scripture reference:", text);
        return null;
    }

    const book = match[1].trim();
    const chapter = parseInt(match[2], 10);
    const verse = match[3] ? match[3].substring(1) : ''; // Remove leading ':'

    return { book, chapter, verse, display: text };
};

// Populate SCRIPTURE_DATA from the embedded JSON data
// This happens once when the module loads
if (Array.isArray(scriptureJSON)) {
    scriptureJSON.forEach(item => {
        const referenceText = item.reference;
        const scriptureText = item.text; // The full text is directly available

        // Construct a generic URL to the Church's scripture study page based on the reference.
        // This URL structure is derived from how churchofjesuschrist.org formats its URLs.
        let url = '#'; // Default placeholder URL

        // Basic parsing for URL construction (can be expanded for more accuracy)
        const parts = referenceText.split(/[\s:]+/); // Splits by space and colon
        if (parts.length >= 2) {
            let urlBook = parts[0].toLowerCase().replace('.', ''); // e.g., 'luke', 'matt', '1ne', 'dc'
            let urlChapter = parts[1];
            let urlVerse = parts.length > 2 ? parts[2].replace(/–/g, '-') : '';

            let volumePath = 'nt'; // Default to New Testament
            if (['1ne', '2ne', 'mosiah', 'alma', 'hel', '3ne', '4ne', 'morm', 'ether', 'moro'].includes(urlBook)) {
                volumePath = 'bofm';
            } else if (urlBook === 'd&c') {
                volumePath = 'dc-testament';
            } else if (urlBook === 'abr') {
                volumePath = 'pgp'; // Pearl of Great Price
            } else if (urlBook === 'moses' || urlBook === 'gen') {
                 volumePath = 'ot'; // Old Testament
            }

            url = `https://www.churchofjesuschrist.org/study/scriptures/${volumePath}/${urlBook}/${urlChapter}${urlVerse ? '.' + urlVerse : ''}?lang=eng`;
        }

        const parsed = parseScriptureReference(referenceText);
        if (parsed) {
            const { book, chapter, verse, display } = parsed;

            // Ensure book entry exists
            if (!SCRIPTURE_DATA[book]) {
                SCRIPTURE_DATA[book] = {};
            }

            // Create chapter key (e.g., "Chapter 1")
            const chapterKey = `Chapter ${chapter}`;
            if (!SCRIPTURE_DATA[book][chapterKey]) {
                SCRIPTURE_DATA[book][chapterKey] = {};
            }

            // Create verse key (e.g., "1:26–38" or "21")
            const verseKey = `${chapter}${verse ? ':' + verse : ''}`;

            // Store the reference text, URL, and the actual scripture text
            SCRIPTURE_DATA[book][chapterKey][verseKey] = {
                linkText: display, // Original reference text e.g., "Luke 1:26–38"
                url: url, // Constructed URL to the Church website
                scriptureText: scriptureText // The actual verse content from your JSON
            };
        }
    });
} else {
    console.warn("scriptureJSON is not an array, or is empty.");
}


const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [readScriptures, setReadScriptures] = useState({}); // { 'Book_ChapterKey_VerseKey': true, ... }
    const [loading, setLoading] = useState(true);
    const [showLoginPrompt, setShowLoginPrompt] = useState(false);
    const [message, setMessage] = useState('');
    const [showMenu, setShowMenu] = useState(false); // State for hamburger menu visibility
    const [guestSession, setGuestSession] = useState(false); // State to track guest session preference


    // Firebase initialization and authentication
    useEffect(() => {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);

            setDb(firestoreDb);
            setAuth(firebaseAuth);

            // Set up auth state listener
            const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
                if (user) {
                    setUserId(user.uid);
                    setMessage(`Logged in as User ID: ${user.uid}`); // Display full UID
                    setShowLoginPrompt(false); // Close prompt on successful login
                    setGuestSession(false); // Reset guest session if user logs in
                } else {
                    setUserId(null);
                    setMessage('Not logged in. Please sign in to save progress.');
                    // Only attempt anonymous sign-in or show prompt if not in a guest session
                    if (!guestSession) {
                        const initialAuth = async () => {
                            try {
                                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                                    await signInWithCustomToken(firebaseAuth, __initial_auth_token);
                                } else {
                                    // Only sign in anonymously if no other auth method is active
                                    if (!firebaseAuth.currentUser) {
                                        await signInAnonymously(firebaseAuth);
                                    }
                                }
                            } catch (error) {
                                console.error("Firebase Auth Error (initial):", error);
                                setMessage(`Authentication error: ${error.message}`);
                            } finally {
                                setLoading(false); // Authentication attempt finished
                            }
                        };
                        initialAuth();
                    } else {
                        setLoading(false); // Stop loading if already in guest session
                    }
                }
                // Ensure loading is false after initial auth state check
                if (firebaseAuth.currentUser === null && !loading) {
                    setLoading(false);
                }
            });

            return () => unsubscribe(); // Cleanup auth listener
        } catch (error) {
            console.error("Firebase Initialization Error:", error);
            setMessage(`Initialization error: ${error.message}`);
            setLoading(false);
        }
    }, [guestSession]); // Add guestSession to dependency array

    // Fetch read scriptures from Firestore
    useEffect(() => {
        if (!db || !userId) return;

        // Construct the Firestore path using the userId
        const userProgressDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/scriptureProgress`, 'readStatus');

        const unsubscribe = onSnapshot(userProgressDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setReadScriptures(docSnap.data().progress || {});
            } else {
                setReadScriptures({}); // No progress yet for this user
            }
        }, (error) => {
            console.error("Error fetching read scriptures:", error);
            setMessage(`Error fetching progress: ${error.message}`);
        });

        return () => unsubscribe(); // Cleanup snapshot listener
    }, [db, userId]); // Re-run when db or userId changes

    // Function to mark a scripture as read/unread
    const toggleReadStatus = useCallback(async (book, chapterKey, verseKey) => {
        if (!db || !userId) {
            if (!guestSession) { // Only prompt if not already in a guest session
                setMessage("Sign in to save your progress.");
                setShowLoginPrompt(true); // Show login prompt if not authenticated
            }
            // For guest session or if user cancels login, allow local state change
            // This is a simplified approach; real guest sessions might use local storage.
            // For now, if not logged in, progress won't persist beyond session.
            const scriptureKey = `${book}_${chapterKey}_${verseKey}`;
            setReadScriptures(prev => {
                const newState = { ...prev };
                if (newState[scriptureKey]) {
                    delete newState[scriptureKey];
                } else {
                    newState[scriptureKey] = true;
                }
                return newState;
            });
            return;
        }

        // Logic to save to Firestore if user is authenticated
        const scriptureKey = `${book}_${chapterKey}_${verseKey}`;
        const newReadStatus = { ...readScriptures };

        if (newReadStatus[scriptureKey]) {
            delete newReadStatus[scriptureKey]; // Mark as unread by removing from map
        } else {
            newReadStatus[scriptureKey] = true; // Mark as read
        }

        const userProgressDocRef = doc(db, `artifacts/${__app_id}/users/${userId}/scriptureProgress`, 'readStatus');

        try {
            // Use setDoc with merge:true to update or create the document without overwriting other fields
            await setDoc(userProgressDocRef, { progress: newReadStatus }, { merge: true });
        } catch (e) {
            console.error("Error writing document: ", e);
            setMessage(`Error saving progress: ${e.message}`);
        }
    }, [db, userId, readScriptures, guestSession]); // Dependencies for useCallback

    // Calculate total scriptures from the parsed SCRIPTURE_DATA
    const totalScriptures = Object.values(SCRIPTURE_DATA).reduce((bookAcc, book) => {
        return bookAcc + Object.values(book).reduce((chapterAcc, chapter) => {
            return chapterAcc + Object.keys(chapter).length;
        }, 0);
    }, 0);

    const numReadScriptures = Object.keys(readScriptures).length;
    // Changed to toFixed(0) for no decimal places
    const progressPercentage = totalScriptures > 0 ? ((numReadScriptures / totalScriptures) * 100).toFixed(0) : 0;

    // Handlers for social logins
    const handleGoogleSignIn = async () => {
        if (!auth) return;
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            setShowLoginPrompt(false); // Close modal on success
            setMessage("Signed in with Google successfully!");
            setShowMenu(false); // Close menu after sign in
        } catch (error) {
            console.error("Google Sign-in Error:", error);
            setMessage(`Google Sign-in failed: ${error.message}`);
        }
    };

    const handleFacebookSignIn = async () => {
        if (!auth) return;
        const provider = new FacebookAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            setShowLoginPrompt(false); // Close modal on success
            setMessage("Signed in with Facebook successfully!");
            setShowMenu(false); // Close menu after sign in
        } catch (error) {
            console.error("Facebook Sign-in Error:", error);
            setMessage(`Facebook Sign-in failed: ${error.message}`);
        }
    };

    const handleSignOut = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setReadScriptures({}); // Clear local progress on sign out
            setMessage("Signed out successfully.");
            setGuestSession(false); // Reset guest session state on sign out
            setShowMenu(false); // Close menu after sign out
        } catch (error) {
            console.error("Sign-out Error:", error);
            setMessage(`Sign-out failed: ${error.message}`);
        }
    };

    const handleContinueLoggedOut = () => {
        setGuestSession(true); // Mark session as guest
        setShowLoginPrompt(false); // Close the prompt
        setMessage("Continuing as guest. Progress will not be saved.");
    };

    // Show main loading state if Firebase/Auth is still initializing
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                <div className="text-2xl font-semibold">Initializing Application...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 font-inter text-gray-800 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 dark:text-gray-200">
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />

            <style>
                {`
                .font-inter {
                    font-family: 'Inter', sans-serif;
                }
                .scroll-container {
                    max-height: calc(100vh - 200px); /* Adjust based on header/footer height */
                    overflow-y: auto;
                    scrollbar-width: thin;
                    scrollbar-color: #9ca3af #f3f4f6; /* thumb and track color */
                }
                .scroll-container::-webkit-scrollbar {
                    width: 8px;
                }
                .scroll-container::-webkit-scrollbar-track {
                    background: #f3f4f6; /* light gray */
                    border-radius: 10px;
                }
                .scroll-container::-webkit-scrollbar-thumb {
                    background-color: #9ca3af; /* medium gray */
                    border-radius: 10px;
                    border: 2px solid #f3f4f6;
                }
                @media (prefers-color-scheme: dark) {
                    .scroll-container::-webkit-scrollbar-track {
                        background: #1f2937; /* dark gray */
                    }
                    .scroll-container::-webkit-scrollbar-thumb {
                        background-color: #4b5563; /* medium dark gray */
                        border: 2px solid #1f2937;
                    }
                }
                `}
            </style>

            <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8">
                <h1 className="text-4xl font-bold text-center mb-6 text-indigo-700 dark:text-blue-400">
                    Scripture Reader
                </h1>

                <div className="relative flex justify-between items-center mb-6 p-4 bg-indigo-50 dark:bg-gray-700 rounded-lg shadow-inner">
                    <div className="text-lg font-semibold flex items-center">
                        <span className="mr-2 text-indigo-600 dark:text-blue-300">User ID:</span>
                        {userId ? (
                            <span className="font-mono text-sm px-2 py-1 bg-indigo-100 dark:bg-gray-600 rounded-md">
                                {userId}
                            </span>
                        ) : (
                            <span className="text-red-500">Not assigned</span>
                        )}
                    </div>
                    <div className="text-lg font-semibold flex items-center">
                        <span className="mr-2 text-indigo-600 dark:text-blue-300">Progress:</span>
                        <span className="text-green-600 dark:text-green-400">
                            {numReadScriptures} / {totalScriptures} ({progressPercentage}%)
                        </span>
                    </div>
                    {/* Hamburger menu button */}
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label="Open menu"
                    >
                        <svg className="w-8 h-8 text-indigo-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7"></path>
                        </svg>
                    </button>

                    {/* Dropdown menu */}
                    {showMenu && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg z-10 py-2">
                            {userId ? (
                                <button
                                    onClick={handleSignOut}
                                    className="block w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-600"
                                >
                                    Sign Out
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        setShowLoginPrompt(true);
                                        setShowMenu(false); // Close hamburger menu when opening login prompt
                                    }}
                                    className="block w-full text-left px-4 py-2 text-indigo-600 dark:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                                >
                                    Sign In
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {message && (
                    <div className="mb-4 p-3 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-lg text-center">
                        {message}
                    </div>
                )}

                <div className="scroll-container space-y-8 p-4 bg-gray-50 dark:bg-gray-750 rounded-xl shadow-inner">
                    {Object.keys(SCRIPTURE_DATA).length === 0 ? (
                        <p className="text-center text-gray-600 dark:text-gray-400">
                            No scriptures loaded or available.
                        </p>
                    ) : (
                        Object.entries(SCRIPTURE_DATA).map(([bookName, bookData]) => (
                            <div key={bookName} className="border-b border-indigo-200 dark:border-gray-600 pb-4 last:border-b-0">
                                <h2 className="text-3xl font-semibold text-indigo-600 dark:text-blue-300 mb-4 px-2 py-1 rounded-md bg-indigo-100 dark:bg-gray-700">
                                    {bookName}
                                </h2>
                                {Object.entries(bookData).map(([chapterName, chapterData]) => (
                                    <div key={`${bookName}-${chapterName}`} className="mb-6 ml-4">
                                        <h3 className="text-xl font-medium text-indigo-500 dark:text-blue-200 mb-3">
                                            {chapterName}
                                        </h3>
                                        <ul className="space-y-3">
                                            {Object.entries(chapterData).map(([verseKey, item]) => {
                                                const scriptureReadStatusKey = `${bookName}_${chapterName}_${verseKey}`;
                                                const isRead = readScriptures[scriptureReadStatusKey];
                                                return (
                                                    <li
                                                        key={scriptureReadStatusKey}
                                                        onClick={() => toggleReadStatus(bookName, chapterName, verseKey)}
                                                        className={`
                                                            p-4 rounded-lg cursor-pointer transition-all duration-200 ease-in-out
                                                            flex items-start
                                                            ${isRead
                                                                ? 'bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 shadow-md border border-green-200 dark:border-green-700'
                                                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                            }
                                                        `}
                                                    >
                                                        <span className={`
                                                            font-bold mr-3 min-w-[80px] text-right
                                                            ${isRead ? 'text-green-600 dark:text-green-400' : 'text-indigo-600 dark:text-blue-400'}
                                                        `}>
                                                            {/* The clickable link is now the scripture reference */}
                                                            <a
                                                                href={item.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-500 hover:underline dark:text-blue-300"
                                                                onClick={(e) => e.stopPropagation()} // Prevent marking as read when clicking link
                                                            >
                                                                {item.linkText}
                                                            </a>
                                                            :
                                                        </span>
                                                        <p className="flex-1 text-base">
                                                            {/* The scripture text is now plain text */}
                                                            {item.scriptureText}
                                                        </p>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>

                {showLoginPrompt && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 max-w-sm w-full text-center relative">
                            <h2 className="text-2xl font-bold mb-4 text-indigo-700 dark:text-blue-400">Sign In</h2>
                            <p className="text-gray-700 dark:text-gray-300 mb-6">
                                Choose a sign-in method to save your progress.
                            </p>
                            <div className="space-y-4">
                                <button
                                    onClick={handleGoogleSignIn}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 shadow-lg text-lg font-semibold"
                                >
                                    <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M22.675 11.375c0-.792-.06-1.577-.18-2.352H12.5v4.51h6.15c-.274 1.488-1.07 2.766-2.217 3.633v2.793h3.585c2.098-1.936 3.308-4.814 3.308-8.084z" fill="#4285F4"/>
                                        <path d="M12.5 22c3.048 0 5.613-1.006 7.48-2.72l-3.585-2.793c-.982.723-2.22 1.15-3.895 1.15-3.003 0-5.55-2.023-6.467-4.75H2.5v2.859C4.385 20.395 8.163 22 12.5 22z" fill="#34A853"/>
                                        <path d="M6.033 13.91c-.244-.723-.385-1.498-.385-2.29s.141-1.567.385-2.29V6.472H2.5C.926 7.859 0 9.877 0 12s.926 4.141 2.5 5.528l3.533-2.618z" fill="#FBBC05"/>
                                        <path d="M12.5 5.38C14.12 5.38 15.617 6.04 16.738 7.042L20.08 3.7C18.106 1.879 15.421.75 12.5.75c-4.337 0-8.115 1.605-10 4.972l3.533 2.618c.917-2.727 3.464-4.75 6.467-4.75z" fill="#EA4335"/>
                                    </svg>
                                    Sign In with Google
                                </button>
                                <button
                                    onClick={handleFacebookSignIn}
                                    className="w-full flex items-center justify-center px-4 py-3 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors duration-200 shadow-lg text-lg font-semibold"
                                >
                                    <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M22.676 12.876c0-5.185-4.215-9.4-9.4-9.4s-9.4 4.215-9.4 9.4c0 4.606 3.308 8.441 7.643 9.176V14.71h-2.91v-2.007h2.91v-1.528c0-2.883 1.76-4.469 4.343-4.469 1.238 0 2.302.22 2.597.316v2.784h-1.666c-1.31 0-1.565.623-1.565 1.536v1.942h3.111l-.504 2.007h-2.607v6.865c4.335-.735 7.643-4.57 7.643-9.176z"/>
                                    </svg>
                                    Sign In with Facebook
                                </button>
                                <button
                                    onClick={handleContinueLoggedOut}
                                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 shadow-sm text-lg font-semibold"
                                >
                                    Continue to use logged out
                                </button>
                            </div>
                            <button
                                onClick={() => setShowLoginPrompt(false)}
                                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                aria-label="Close"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;
