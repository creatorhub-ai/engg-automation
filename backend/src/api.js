import express from 'express';
import supabase from './supabaseClient.js';

const router = express.Router();

router.get('/learners', async (req, res) => {
  const { data, error } = await supabase.from('learners').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

export default router;
