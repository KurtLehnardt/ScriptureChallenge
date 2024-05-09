const router = require('express').Router()
const passport = require('passport')
const path = require('path')

// see about using chained route handlers for scriptureList get, post and put.
// e.g. app.route('/completedScriptures')
//   .get(function (req, res) {
//     res.send('See all scriptures you've read')
//   })
//   .post(function (req, res) {
//     res.send('Update scripture list')
//   })
//   .put(function (req, res) {
//     res.send('See who has read the most')
//   })

router.get('/login', (req, res) => {
    //handle with passport
    res.render('login')
})

router.get('/logout', (req, res) => {
    // handle with passport
    res.render('logout')
})

// google auth
router.get('/google', passport.authenticate('google', {
    scope: ['profile']
}))


// google auth callback route
router.get('/google/redirect', (req, res) => {
    //res.send('this is the redir uri')
    //res.sendFile(path.join(__dirname + '/gameList.html'))
    res.sendFile('scriptureList.html', { root: './public' })
})
router.get('/scriptureList.css', (req, res) => {
    res.sendFile('scriptureList.css', { root: './public' })
})

router.get('/users/:userId/scripture/:scriptureId',(req, res) => {
  console.dir(req.params.userId, req.params.gameId)
  res.send(req.params)
})

router.post('/', (req, res) => {
  res.send('POST request to home page')
})

// handle bad URI
router.get('*', (req, res, next) => {
    res.status(404).render('404')
    next()
})

module.exports = router
