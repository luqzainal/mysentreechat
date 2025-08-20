const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Middleware untuk proteksi
const Setting = require('../models/Settings');
const OpenAI = require('openai');

// @desc    Get AI settings for the logged in user
// @route   GET /api/settings/ai
// @access  Private
router.get('/ai', protect, async (req, res) => {
  try {
    let settings = await Setting.findOne({ userId: req.user.id }).select('openaiApiKey aiModel aiTemperature aiMaxTokens');
    if (!settings) {
      // Jika tiada settings, kembalikan default values
      return res.json({ 
        openaiApiKey: '',
        aiModel: 'gpt-3.5-turbo',
        aiTemperature: 0.7,
        aiMaxTokens: 1000
      });
    }
    
    res.json({ 
      openaiApiKey: settings.openaiApiKey || '',
      aiModel: settings.aiModel || 'gpt-3.5-turbo',
      aiTemperature: settings.aiTemperature || 0.7,
      aiMaxTokens: settings.aiMaxTokens || 1000
    });
  } catch (error) {
    console.error('Error getting AI settings:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update AI settings for the logged in user
// @route   PUT /api/settings/ai
// @access  Private
router.put('/ai', protect, async (req, res) => {
  const { openaiApiKey, aiModel, aiTemperature, aiMaxTokens } = req.body;

  if (typeof openaiApiKey === 'undefined') {
      return res.status(400).json({ message: 'openaiApiKey is required' });
  }

  // Validate AI settings if provided
  if (aiTemperature !== undefined && (aiTemperature < 0 || aiTemperature > 1)) {
    return res.status(400).json({ message: 'aiTemperature must be between 0 and 1' });
  }

  if (aiMaxTokens !== undefined && (aiMaxTokens < 100 || aiMaxTokens > 4000)) {
    return res.status(400).json({ message: 'aiMaxTokens must be between 100 and 4000' });
  }

  try {
    let settings = await Setting.findOne({ userId: req.user.id });

    if (!settings) {
      // Jika tiada, cipta baru
      settings = await Setting.create({
        userId: req.user.id,
        openaiApiKey: openaiApiKey,
        aiModel: aiModel || 'gpt-3.5-turbo',
        aiTemperature: aiTemperature || 0.7,
        aiMaxTokens: aiMaxTokens || 1000
      });
    } else {
      // Jika ada, kemaskini
      settings.openaiApiKey = openaiApiKey;
      if (aiModel !== undefined) settings.aiModel = aiModel;
      if (aiTemperature !== undefined) settings.aiTemperature = aiTemperature;
      if (aiMaxTokens !== undefined) settings.aiMaxTokens = aiMaxTokens;
      await settings.save();
    }

    res.json({ message: 'AI settings updated successfully' });

  } catch (error) {
    console.error('Error updating AI settings:', error);
     if (error.code === 11000) { // Duplicate key error (sepatutnya tidak berlaku jika logik findOneAndUpdate betul)
         return res.status(400).json({ message: 'Settings already exist for user' });
     }
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Test OpenAI API connection
// @route   POST /api/settings/ai/test
// @access  Private
router.post('/ai/test', protect, async (req, res) => {
  const { apiKey, testMessage } = req.body;

  // Use provided API key or get from user settings
  let testApiKey = apiKey;
  let userAiModel = 'gpt-3.5-turbo';
  let userTemperature = 0.7;
  
  try {
    const settings = await Setting.findOne({ userId: req.user.id }).select('openaiApiKey aiModel aiTemperature');
    if (!testApiKey) {
      testApiKey = settings?.openaiApiKey;
    }
    // Use user's saved AI settings for testing
    userAiModel = settings?.aiModel || 'gpt-3.5-turbo';
    userTemperature = settings?.aiTemperature || 0.7;
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Error retrieving settings' 
    });
  }

  if (!testApiKey) {
    return res.status(400).json({ 
      success: false, 
      message: 'No API key provided. Please enter your OpenAI API key or save it in settings first.' 
    });
  }

  // Validate API key format
  if (!testApiKey.startsWith('sk-')) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid API key format. OpenAI API keys should start with "sk-"' 
    });
  }

  try {
    // Initialize OpenAI client with the provided API key
    const openai = new OpenAI({
      apiKey: testApiKey,
    });

    const testPrompt = testMessage || "Hello! This is a test message to verify API connection. Please respond with 'API connection successful!'";

    console.log(`[AI Test] Testing API key for user ${req.user.id}`);
    
    // Make a simple test request to OpenAI using user's settings
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: userAiModel,
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant. Respond briefly to test messages."
        },
        {
          role: "user",
          content: testPrompt
        }
      ],
      max_tokens: 50,
      temperature: userTemperature
    });

    const responseTime = Date.now() - startTime;
    const response = completion.choices[0]?.message?.content;

    console.log(`[AI Test] Success for user ${req.user.id}. Response time: ${responseTime}ms`);

    res.json({
      success: true,
      message: 'OpenAI API connection successful!',
      data: {
        response: response,
        model: completion.model,
        tokensUsed: completion.usage?.total_tokens || 0,
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`[AI Test] Failed for user ${req.user.id}:`, error.message);

    let errorMessage = 'Failed to connect to OpenAI API';
    let errorCode = 'UNKNOWN_ERROR';

    if (error.status === 401) {
      errorMessage = 'Invalid API key. Please check your OpenAI API key and try again.';
      errorCode = 'INVALID_API_KEY';
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again later.';
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.status === 402) {
      errorMessage = 'Insufficient credits. Please check your OpenAI account billing.';
      errorCode = 'INSUFFICIENT_CREDITS';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Network error. Please check your internet connection.';
      errorCode = 'NETWORK_ERROR';
    } else if (error.message) {
      errorMessage = error.message;
    }

    res.status(400).json({
      success: false,
      message: errorMessage,
      errorCode: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get available AI models
// @route   GET /api/settings/ai/models
// @access  Private
router.get('/ai/models', protect, async (req, res) => {
  try {
    const settings = await Setting.findOne({ userId: req.user.id }).select('openaiApiKey');
    const apiKey = settings?.openaiApiKey;

    if (!apiKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'No API key found. Please configure your OpenAI API key first.' 
      });
    }

    const openai = new OpenAI({ apiKey: apiKey });
    const models = await openai.models.list();
    
    // Filter for chat models
    const chatModels = models.data
      .filter(model => model.id.includes('gpt'))
      .map(model => ({
        id: model.id,
        name: model.id,
        created: model.created,
        owned_by: model.owned_by
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    res.json({
      success: true,
      models: chatModels
    });

  } catch (error) {
    console.error('Error fetching AI models:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to fetch available models. Please check your API key.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router; 