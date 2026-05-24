const express = require('express');
const router = express.Router();
const {
  getChallenges, getStreak,
  getAdminChallenges, createChallenge, updateChallenge, toggleChallenge, archiveChallenge,
} = require('../controllers/challengeController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

router.get('/streak',        protect, getStreak);
router.get('/admin',         protect, isAdmin, getAdminChallenges);
router.post('/',             protect, isAdmin, createChallenge);
router.patch('/:id/toggle',  protect, isAdmin, toggleChallenge);
router.patch('/:id',         protect, isAdmin, updateChallenge);
router.delete('/:id',        protect, isAdmin, archiveChallenge);
router.get('/',              protect, getChallenges);

module.exports = router;
