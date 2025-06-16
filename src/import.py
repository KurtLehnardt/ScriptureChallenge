import re
import requests
import json
import os
from scripture_data import scripture_list # Import the scripture list from the new file

# Base URL for the scripture JSON files
BASE_URL = "https://raw.githubusercontent.com/allancoding/scriptures/main/"

# Map book names (or abbreviations) to their corresponding JSON filenames
book_to_file_map = {
    'Luke': 'new-testament.json',
    'Matt.': 'new-testament.json',
    '1 Ne.': 'book-of-mormon.json',
    '2 Ne.': 'book-of-mormon.json',
    'Mosiah': 'book-of-mormon.json',
    'D&C': 'doctrine-and-covenants.json',
    # Comprehensive mapping for all books and their common abbreviations to filenames
    # Old Testament books
    'Gen.': 'old-testament.json', 'Ex.': 'old-testament.json', 'Lev.': 'old-testament.json',
    'Num.': 'old-testament.json', 'Deut.': 'old-testament.json', 'Josh.': 'old-testament.json',
    'Judg.': 'old-testament.json', 'Ruth': 'old-testament.json', '1 Sam.': 'old-testament.json',
    '2 Sam.': 'old-testament.json', '1 Kgs.': 'old-testament.json', '2 Kgs.': 'old-testament.json',
    '1 Chr.': 'old-testament.json', '2 Chr.': 'old-testament.json', 'Ezra': 'old-testament.json',
    'Neh.': 'old-testament.json', 'Esth.': 'old-testament.json', 'Job': 'old-testament.json',
    'Ps.': 'old-testament.json', 'Prov.': 'old-testament.json', 'Eccl.': 'old-testament.json',
    'Song.': 'old-testament.json', 'Isa.': 'old-testament.json', 'Jer.': 'old-testament.json',
    'Lam.': 'old-testament.json', 'Ezek.': 'old-testament.json', 'Dan.': 'old-testament.json',
    'Hosea': 'old-testament.json', 'Joel': 'old-testament.json', 'Amos': 'old-testament.json',
    'Obad.': 'old-testament.json', 'Jonah': 'old-testament.json', 'Micah': 'old-testament.json',
    'Nahum': 'old-testament.json', 'Hab.': 'old-testament.json', 'Zeph.': 'old-testament.json',
    'Hag.': 'old-testament.json', 'Zech.': 'old-testament.json', 'Mal.': 'old-testament.json',
    # New Testament books
    'Mark': 'new-testament.json', 'John': 'new-testament.json', 'Acts': 'new-testament.json',
    'Rom.': 'new-testament.json', '1 Cor.': 'new-testament.json', '2 Cor.': 'new-testament.json',
    'Gal.': 'new-testament.json', 'Eph.': 'new-testament.json', 'Philip.': 'new-testament.json',
    'Col.': 'new-testament.json', '1 Thes.': 'new-testament.json', '2 Thes.': 'new-testament.json',
    '1 Tim.': 'new-testament.json', '2 Tim.': 'new-testament.json', 'Titus': 'new-testament.json',
    'Philem.': 'new-testament.json', 'Heb.': 'new-testament.json', 'James': 'new-testament.json',
    '1 Pet.': 'new-testament.json', '2 Pet.': 'new-testament.json', '1 Jn.': 'new-testament.json',
    '2 Jn.': '2 Jn.', '3 Jn.': '3 Jn.', 'Jude': 'new-testament.json', 'Rev.': 'new-testament.json',
    # Book of Mormon books
    'Enos': 'book-of-mormon.json', 'Jarom': 'book-of-mormon.json', 'Omni': 'book-of-mormon.json',
    'W of M': 'book-of-mormon.json', 'Words of Mormon': 'book-of-mormon.json',
    'Morm.': 'book-of-mormon.json', 'Ether': 'book-of-mormon.json', 'Moro.': 'book-of-mormon.json',
    'Alma': 'book-of-mormon.json', 'Hel.': 'book-of-mormon.json', '3 Ne.': 'book-of-mormon.json',
    '4 Ne.': 'book-of-mormon.json',
    'Jacob': 'book-of-mormon.json', # Added mapping for Jacob
    # Pearl of Great Price books
    'Abr.': 'pearl-of-great-price.json', 'Moses': 'pearl-of-great-price.json',
    'JS—M': 'pearl-of-great-price.json', 'JS—H': 'pearl-of-great-price.json',
    'A of F': 'pearl-of-great-price.json',
}

# Cache for loaded JSON data to avoid re-fetching large files
loaded_scriptures_cache = {}

# Define a comprehensive map for URL slugs to standardized book names
url_slug_to_book_name_map = {
    'gen': 'Gen.', 'ex': 'Ex.', 'lev': 'Lev.', 'num': 'Num.', 'deut': 'Deut.', 'josh': 'Josh.',
    'judg': 'Judg.', 'ruth': 'Ruth', '1-sam': '1 Sam.', '2-sam': '2 Sam.', '1-kgs': '1 Kgs.',
    '2-kgs': '2 Kgs.', '1-chr': '1 Chr.', '2-chr': '2 Chr.', 'ezra': 'Ezra', 'neh': 'Neh.',
    'esth': 'Esth.', 'job': 'Job', 'ps': 'Ps.', 'prov': 'Prov.', 'eccl': 'Eccl.',
    'song': 'Song.', 'isa': 'Isa.', 'jer': 'Jer.', 'lam': 'Lam.', 'ezek': 'Ezek.',
    'dan': 'Dan.', 'hosea': 'Hosea', 'joel': 'Joel', 'amos': 'Amos', 'obad': 'Obad.',
    'jonah': 'Jonah', 'micah': 'Micah', 'nahum': 'Nahum', 'hab': 'Hab.', 'zeph': 'Zeph.',
    'hag': 'Hag.', 'zech': 'Zech.', 'mal': 'Mal.',

    'matt': 'Matt.', 'mark': 'Mark', 'luke': 'Luke', 'Luke': 'Luke',
    'john': 'John', 'acts': 'Acts',
    'rom': 'Rom.', '1-cor': '1 Cor.', '2-cor': '2 Cor.', 'gal': 'Gal.', 'eph': 'Eph.',
    'philip': 'Philip.', 'col': 'Col.', '1-thes': '1 Thes.', '2-thes': '2 Thes.',
    '1-tim': '1 Tim.', '2-tim': '2 Tim.', 'titus': 'Titus', 'philem': 'Philem.',
    'heb': 'Heb.', 'james': 'James', '1-pet': '1 Pet.', '2-pet': '2 Pet.',
    '1-jn': '1 Jn.', '2-jn': '2 Jn.', '3-jn': '3 Jn.', 'jude': 'Jude', 'rev': 'Rev.',

    '1-ne': '1 Ne.', '2-ne': '2 Ne.', 'jacob': 'Jacob', 'enos': 'Enos', 'jarom': 'Jarom',
    'omni': 'Omni', 'w-of-m': 'W of M', 'mosiah': 'Mosiah', 'alma': 'Alma', 'hel': 'Hel.',
    '3-ne': '3 Ne.', '4-ne': '4 Ne.', 'morm': 'Morm.', 'ether': 'Ether', 'moro': 'Moro.',

    'dc': 'D&C',
    'moses': 'Moses', 'abr': 'Abr.', 'js-m': 'JS—M', 'js-h': 'JS—H', 'a-of-f': 'A of F'
}

# Define a comprehensive map for abbreviations to full names used in JSON
abbreviation_to_full_name_map = {
    '1 Ne.': '1 Nephi', '2 Ne.': '2 Nephi', '3 Ne.': '3 Nephi', '4 Ne.': '4 Nephi',
    'Alma': 'Alma', 'Hel.': 'Helaman', 'Ether': 'Ether', 'Moro.': 'Moroni',
    'Morm.': 'Mormon', 'Mosiah': 'Mosiah', 'Enos': 'Enos', 'Jarom': 'Jarom', 'Omni': 'Omni',
    'W of M': 'Words of Mormon', # Input: W of M, JSON: Words of Mormon

    'Matt.': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke', 'John': 'John', 'Acts': 'Acts',
    'Rom.': 'Romans', '1 Cor.': '1 Corinthians', '2 Cor.': '2 Corinthians', 'Gal.': 'Galatians',
    'Eph.': 'Ephesians', 'Philip.': 'Philippians', 'Col.': 'Colossians', '1 Thes.': '1 Thessalonians',
    '2 Thes.': '2 Thessalonians', '1 Tim.': '1 Timothy', '2 Tim.': '2 Timothy', 'Titus': 'Titus',
    'Philem.': 'Philemon', 'Heb.': 'Hebrews', 'James': 'James', '1 Pet.': '1 Peter', '2 Pet.': '2 Peter',
    '1 Jn.': '1 John', '2 Jn.': '2 John', '3 Jn.': '3 John', 'Jude': 'Jude', 'Rev.': 'Revelation',

    'Gen.': 'Genesis', 'Ex.': 'Exodus', 'Lev.': 'Leviticus', 'Num.': 'Numbers', 'Deut.': 'Deuteronomy',
    'Josh.': 'Joshua', 'Judg.': 'Judges', 'Ruth': 'Ruth', '1 Sam.': '1 Samuel', '2 Sam.': '2 Samuel',
    '1 Kgs.': '1 Kings', '2 Kgs.': '2 Kings', '1 Chr.': '1 Chronicles', '2 Chr.': '2 Chronicles',
    'Ezra': 'Ezra', 'Neh.': 'Nehemiah', 'Esth.': 'Esther', 'Job': 'Job', 'Ps.': 'Psalms',
    'Prov.': 'Proverbs', 'Eccl.': 'Ecclesiastes', 'Song.': 'Song of Solomon', 'Isa.': 'Isaiah',
    'Jer.': 'Jeremiah', 'Lam.': 'Lamentations', 'Ezek.': 'Ezekiel', 'Dan.': 'Daniel',
    'Hosea': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos', 'Obad.': 'Obadiah', 'Jonah': 'Jonah',
    'Micah': 'Micah', 'Nahum': 'Nahum', 'Hab.': 'Habakkuk', 'Zeph.': 'Zephaniah',
    'Hag.': 'Haggai', 'Zech.': 'Zechariah', 'Mal.': 'Malachi',

    'D&C': 'Doctrine and Covenants',
    'Abr.': 'Abraham',
    'Moses': 'Moses',
    'JS—M': 'Joseph Smith—Matthew',
    'JS—H': 'Joseph Smith—History',
    'A of F': 'Articles of Faith',
    'Jacob': 'Jacob', # Added mapping for Jacob
}

def parse_scripture_reference(ref_html):
    """
    Parses an HTML <a> tag to extract the scripture reference string.
    It prioritizes extracting the book name from the URL for robustness,
    then parses the text for chapter and verses, including multiple,
    comma-separated ranges. It then constructs a consistent full_ref_string.
    """
    # Regex to extract href and visible text
    match_full = re.search(r'<a href="(.*?)"[^>]*>(.*?)</a>', ref_html)
    if not match_full:
        print(f"Warning: Could not parse HTML link: {ref_html}")
        return None

    url = match_full.group(1)
    visible_text = match_full.group(2).strip()

    # Extract book slug from URL (e.g., 'matt', '1-ne', 'dc')
    url_book_slug_match = re.search(r'/scriptures/(?:nt|ot|bofm|dc-testament|pgp)/([^/]+)/\d+', url)
    book_abbreviation = None # This will store the standardized abbreviation (e.g., 'Matt.', 'Luke')
    if url_book_slug_match:
        slug = url_book_slug_match.group(1)
        book_abbreviation = url_slug_to_book_name_map.get(slug)
        if not book_abbreviation:
            print(f"Warning: Unknown URL slug '{slug}' for book in URL: {url}")
    else:
        print(f"Warning: Could not extract book slug from URL: {url}")

    # Ensure we have a book abbreviation for lookup. If not derived from URL, parsing will fail.
    if not book_abbreviation:
        print(f"Error: No book name determined from URL for: {ref_html}")
        return None

    # Regex to extract chapter and the entire verse string (e.g., "1-11,27-28")
    match_ref_text = re.match(r'^(?:.*?\s+)?(\d+):(.+)$', visible_text)

    if not match_ref_text:
        print(f"Warning: Could not parse chapter/verse from visible text: {visible_text}")
        return None

    chapter = int(match_ref_text.group(1))
    verse_string_raw = match_ref_text.group(2)

    # Parse individual verse ranges from the raw verse string
    verse_ranges = []
    individual_verse_parts = verse_string_raw.split(',')
    formatted_verse_parts_for_output = [] # To build the consistent full_ref_string
    for part in individual_verse_parts:
        verse_range_match = re.match(r'(\d+)(?:[–—](\d+))?', part.strip())
        if verse_range_match:
            start_v = int(verse_range_match.group(1))
            end_v = int(verse_range_match.group(2)) if verse_range_match.group(2) else start_v
            verse_ranges.append({'start': start_v, 'end': end_v})

            # Format for the consistent output reference string
            if start_v == end_v:
                formatted_verse_parts_for_output.append(str(start_v))
            else:
                formatted_verse_parts_for_output.append(f"{start_v}–{end_v}")
        else:
            print(f"Warning: Could not parse individual verse part: '{part}' in '{visible_text}'")
            continue

    if not verse_ranges:
        print(f"Error: No valid verse ranges found for: {visible_text}")
        return None

    # Construct the full_ref_string for consistent output (e.g., "Luke 5:1–11, 27–28")
    # This combines the determined book, chapter, and formatted verse ranges.
    constructed_full_ref_string = f"{book_abbreviation} {chapter}:{','.join(formatted_verse_parts_for_output)}"

    return {
        'book': book_abbreviation, # This 'book' is the standardized abbreviation/name for lookup
        'chapter': chapter,
        'verse_ranges': verse_ranges, # List of {'start': int, 'end': int} dictionaries
        'full_ref_string': constructed_full_ref_string # This is the newly constructed, consistent reference
    }

def get_book_json_data(book_name):
    """
    Fetches and caches the JSON data for a given book.
    """
    if book_name in loaded_scriptures_cache:
        return loaded_scriptures_cache[book_name]

    filename = book_to_file_map.get(book_name)
    if not filename:
        print(f"Error: No JSON file mapped for book: {book_name}")
        return None

    url = f"{BASE_URL}{filename}"
    print(f"Fetching data for {book_name} from {url}...")
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)
        data = response.json()
        loaded_scriptures_cache[book_name] = data
        return data
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {url}: {e}")
        return None
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON from {url}: {e}")
        return None


def lookup_and_write_scriptures(scripture_list, output_filepath):
    """
    Looks up the text of each scripture in the provided list and writes it to a JSON file.
    This version handles both JSON structures (top-level 'sections' or 'books' -> 'chapters')
    and includes a more comprehensive mapping for scripture abbreviations to their full names.
    It now prioritizes extracting the book name from the URL for increased robustness.

    The output will be a JSON array, where each element is an object with 'reference' and 'text' keys.

    Args:
        scripture_list (list): A list of HTML <a> tags containing scripture references.
        output_filepath (str): The path to the JSON file where the scripture data will be written.
    """
    output_data = [] # List to hold all scripture dictionaries

    for scripture_html in scripture_list:
        parsed_ref = parse_scripture_reference(scripture_html)
        if not parsed_ref:
            # If parsing fails entirely, record the raw HTML and a generic error.
            output_data.append({
                "reference": scripture_html,
                "text": "Scripture not found/parsed."
            })
            continue

        book_data = get_book_json_data(parsed_ref['book'])
        if not book_data:
            # If book data cannot be retrieved, record the parsed reference and a specific error.
            output_data.append({
                "reference": parsed_ref['full_ref_string'],
                "text": f"Data not available for book: {parsed_ref['book']}"
            })
            continue

        found_text_parts = [] # Collect individual verse texts here
        # Convert the parsed book abbreviation/name to the full name expected in JSON
        target_book_name_in_json = abbreviation_to_full_name_map.get(parsed_ref['book'], parsed_ref['book'])

        # Logic for 'books' structure (e.g., BoM, OT, NT)
        if 'books' in book_data:
            found_book_in_json = False
            for book_obj in book_data['books']:
                if book_obj.get('book') == target_book_name_in_json:
                    found_book_in_json = True
                    for chapter_obj in book_obj.get('chapters', []):
                        if chapter_obj.get('chapter') == parsed_ref['chapter']:
                            # Get all verses for the current chapter and store them by verse number for quick lookup
                            verses_in_chapter = {v_obj.get('verse'): v_obj.get('text', '') for v_obj in chapter_obj.get('verses', [])}

                            # Iterate through all specified verse ranges from parsed_ref
                            for target_range in parsed_ref['verse_ranges']:
                                for current_verse_num in range(target_range['start'], target_range['end'] + 1):
                                    if current_verse_num in verses_in_chapter:
                                        found_text_parts.append(verses_in_chapter[current_verse_num])
                            break # Found the chapter, no need to check other chapters in this book
                    break # Found the book, no need to check other books
            if not found_book_in_json:
                print(f"Warning: Book '{target_book_name_in_json}' not found in JSON data for {parsed_ref['book']}'s file.")
        # Logic for 'sections' structure (e.g., D&C, PoGP)
        elif 'sections' in book_data:
            for section in book_data.get('sections', []):
                section_ref_prefix = f"{parsed_ref['book']} {parsed_ref['chapter']}" # Use parsed_ref['book'] (abbreviation)
                if section.get('reference') == section_ref_prefix:
                    # Get all verses for the current section and store them by verse number for quick lookup
                    verses_in_section = {v_obj.get('verse'): v_obj.get('text', '') for v_obj in section.get('verses', [])}

                    # Iterate through all specified verse ranges from parsed_ref
                    for target_range in parsed_ref['verse_ranges']:
                        for current_verse_num in range(target_range['start'], target_range['end'] + 1):
                            if current_verse_num in verses_in_section:
                                found_text_parts.append(verses_in_section[current_verse_num])
                    break # Found the section, no need to check other sections
        else:
            print(f"Error: Unknown JSON structure for {parsed_ref['book']}'s file. Neither 'books' nor 'sections' found at top level.")


        if found_text_parts:
            # Join the collected verse texts, ensuring they are unique and in order
            output_data.append({
                "reference": parsed_ref['full_ref_string'], # Now consistently formatted
                "text": " ".join(found_text_parts).strip()
            })
        else:
            output_data.append({
                "reference": parsed_ref['full_ref_string'], # Still use this for error cases
                "text": "Scripture not found in JSON."
            })

    # Write the collected data to the JSON file
    with open(output_filepath, 'w', encoding='utf-8') as outfile:
        json.dump(output_data, outfile, indent=2, ensure_ascii=False)

    print(f"Scripture data has been written to: {output_filepath}")

# Define the output file name
output_file = "scripture_texts.json"

# Call the function to perform the lookup and writing
lookup_and_write_scriptures(scripture_list, output_file)
