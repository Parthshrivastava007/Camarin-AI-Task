const axios = require('axios');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Initialize Google Vision Client if credentials are provided
let visionClient = null;
try {
  // Check if credentials are set (either environment JSON path or raw environment vars)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const vision = require('@google-cloud/vision');
    visionClient = new vision.ImageAnnotatorClient();
    console.log('Google Cloud Vision Client initialized successfully.');
  }
} catch (err) {
  console.warn('Could not initialize Google Cloud Vision client. Falling back to Mock/REST mode.', err.message);
}

/**
 * Generate a mock caption based on the filename keywords.
 */
const generateMockCaption = (fileName) => {
  const name = fileName.toLowerCase();
  if (name.includes('dog') || name.includes('puppy')) {
    return 'A cute dog sitting on the grass looking directly at the camera.';
  }
  if (name.includes('cat') || name.includes('kitten')) {
    return 'A playful kitten playing with a ball of yarn on the floor.';
  }
  if (name.includes('nature') || name.includes('landscape') || name.includes('mountain')) {
    return 'A stunning landscape view of mountains reflecting on a clear lake under a blue sky.';
  }
  if (name.includes('car') || name.includes('vehicle')) {
    return 'A sleek modern sports car parked on a scenic coastal highway.';
  }
  if (name.includes('food') || name.includes('pizza') || name.includes('burger')) {
    return 'A delicious, freshly prepared gourmet meal served on a plate.';
  }
  if (name.includes('unsafe') || name.includes('flagged') || name.includes('adult')) {
    return 'A close-up shot of sensitive or restricted content.';
  }
  return 'A high-quality image captured in natural lighting conditions.';
};

/**
 * Generate mock labels based on the filename keywords.
 */
const generateMockLabels = (fileName) => {
  const name = fileName.toLowerCase();
  const baseLabels = ['Photograph', 'Image', 'Visual Media'];
  
  if (name.includes('dog') || name.includes('puppy')) {
    return [...baseLabels, 'Canine', 'Dog', 'Pet', 'Mammal', 'Grass'];
  }
  if (name.includes('cat') || name.includes('kitten')) {
    return [...baseLabels, 'Feline', 'Cat', 'Pet', 'Kitten', 'Playful'];
  }
  if (name.includes('nature') || name.includes('landscape') || name.includes('mountain')) {
    return [...baseLabels, 'Landscape', 'Mountain', 'Lake', 'Sky', 'Outdoors', 'Reflection'];
  }
  if (name.includes('car') || name.includes('vehicle')) {
    return [...baseLabels, 'Vehicle', 'Car', 'Automobile', 'Transport', 'Road', 'Sports Car'];
  }
  if (name.includes('food') || name.includes('pizza') || name.includes('burger')) {
    return [...baseLabels, 'Food', 'Dish', 'Cuisine', 'Meal', 'Appetizing'];
  }
  return [...baseLabels, 'Enriched Metadata', 'Digital Image', 'Still Life'];
};

/**
 * Generate mock SafeSearch based on filename keywords.
 * If file contains 'unsafe', 'adult', 'violence', etc., it mocks unsafe outputs.
 */
const generateMockSafeSearch = (fileName) => {
  const name = fileName.toLowerCase();
  
  const result = {
    adult: 'VERY_UNLIKELY',
    spoof: 'VERY_UNLIKELY',
    medical: 'VERY_UNLIKELY',
    violence: 'VERY_UNLIKELY',
    racy: 'VERY_UNLIKELY',
  };

  if (name.includes('unsafe') || name.includes('adult')) {
    result.adult = 'VERY_LIKELY';
  }
  if (name.includes('violence') || name.includes('blood')) {
    result.violence = 'LIKELY';
  }
  if (name.includes('racy') || name.includes('bikini')) {
    result.racy = 'VERY_LIKELY';
  }
  if (name.includes('medical') || name.includes('surgery')) {
    result.medical = 'LIKELY';
  }
  if (name.includes('spoof') || name.includes('meme')) {
    result.spoof = 'LIKELY';
  }

  return result;
};

/**
 * Step 1: Image Captioning using Hugging Face Salesforce/blip-image-captioning-base
 */
const getImageCaption = async (imagePath, originalName) => {
  const resolvedPath = path.resolve(imagePath);

  if (!config.hfApiToken) {
    console.log(`[AI Service] HF_API_TOKEN is missing. Generating mock caption for ${originalName}...`);
    return generateMockCaption(originalName);
  }

  try {
    const imageBuffer = fs.readFileSync(resolvedPath);
    
    // Call HF Inference API with retry (if loading)
    let retries = 3;
    let response;
    
    while (retries > 0) {
      try {
        response = await axios.post(
          'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base',
          imageBuffer,
          {
            headers: {
              Authorization: `Bearer ${config.hfApiToken}`,
              'Content-Type': 'application/octet-stream',
            },
            timeout: 15000,
          }
        );
        
        // If the model is loading, wait and retry
        if (response.data && response.data.error && response.data.error.includes('loading')) {
          const waitTime = (response.data.estimated_time || 5) * 1000;
          console.log(`[AI Service] Hugging Face model is loading. Waiting ${waitTime}ms. Retries left: ${retries - 1}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries--;
          continue;
        }
        
        break; // Success
      } catch (err) {
        if (err.response && err.response.data && err.response.data.error && err.response.data.error.includes('loading')) {
          const waitTime = (err.response.data.estimated_time || 5) * 1000;
          console.log(`[AI Service] Hugging Face model is loading. Waiting ${waitTime}ms. Retries left: ${retries - 1}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          retries--;
          continue;
        }
        throw err;
      }
    }

    if (response && response.data && response.data[0] && response.data[0].generated_text) {
      // Capitalize first letter
      const text = response.data[0].generated_text;
      return text.charAt(0).toUpperCase() + text.slice(1);
    }

    throw new Error('Invalid response structure from Hugging Face Inference API');
  } catch (error) {
    console.error('[AI Service] Hugging Face Captioning error:', error.response?.data || error.message);
    console.log('[AI Service] Falling back to mock caption due to API error.');
    return generateMockCaption(originalName);
  }
};

/**
 * Step 2: Object/Label Detection
 */
const getImageLabels = async (imagePath, originalName) => {
  const resolvedPath = path.resolve(imagePath);

  if (!visionClient) {
    // If no client, try REST endpoint if API key exists
    if (config.googleApiKey) {
      try {
        return await getLabelsViaRest(resolvedPath, config.googleApiKey);
      } catch (err) {
        console.error('[AI Service] Google Vision REST Label Detection error:', err.message);
      }
    }
    console.log(`[AI Service] Google Vision credentials missing. Generating mock labels for ${originalName}...`);
    return generateMockLabels(originalName);
  }

  try {
    const [result] = await visionClient.labelDetection(resolvedPath);
    const labels = result.labelAnnotations || [];
    return labels.map(label => label.description);
  } catch (error) {
    console.error('[AI Service] Google Vision client label detection error:', error.message);
    console.log('[AI Service] Falling back to mock labels.');
    return generateMockLabels(originalName);
  }
};

/**
 * Step 3: Content Safety Check (SafeSearch)
 */
const getImageSafeSearch = async (imagePath, originalName) => {
  const resolvedPath = path.resolve(imagePath);

  if (!visionClient) {
    // If no client, try REST endpoint if API key exists
    if (config.googleApiKey) {
      try {
        return await getSafeSearchViaRest(resolvedPath, config.googleApiKey);
      } catch (err) {
        console.error('[AI Service] Google Vision REST SafeSearch error:', err.message);
      }
    }
    console.log(`[AI Service] Google Vision credentials missing. Generating mock SafeSearch for ${originalName}...`);
    return generateMockSafeSearch(originalName);
  }

  try {
    const [result] = await visionClient.safeSearchDetection(resolvedPath);
    const safeSearch = result.safeSearchAnnotation;
    
    if (!safeSearch) {
      throw new Error('No SafeSearch annotation returned');
    }

    return {
      adult: safeSearch.adult || 'UNKNOWN',
      spoof: safeSearch.spoof || 'UNKNOWN',
      medical: safeSearch.medical || 'UNKNOWN',
      violence: safeSearch.violence || 'UNKNOWN',
      racy: safeSearch.racy || 'UNKNOWN',
    };
  } catch (error) {
    console.error('[AI Service] Google Vision client SafeSearch error:', error.message);
    console.log('[AI Service] Falling back to mock SafeSearch.');
    return generateMockSafeSearch(originalName);
  }
};

// Helper: Call Google Vision API via REST for Label Detection
const getLabelsViaRest = async (resolvedPath, apiKey) => {
  const imageBase64 = fs.readFileSync(resolvedPath, { encoding: 'base64' });
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  
  const response = await axios.post(url, {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: 'LABEL_DETECTION', maxResults: 10 }],
      },
    ],
  });

  const annotations = response.data?.responses?.[0]?.labelAnnotations || [];
  return annotations.map(label => label.description);
};

// Helper: Call Google Vision API via REST for SafeSearch
const getSafeSearchViaRest = async (resolvedPath, apiKey) => {
  const imageBase64 = fs.readFileSync(resolvedPath, { encoding: 'base64' });
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
  
  const response = await axios.post(url, {
    requests: [
      {
        image: { content: imageBase64 },
        features: [{ type: 'SAFE_SEARCH_DETECTION' }],
      },
    ],
  });

  const safeSearch = response.data?.responses?.[0]?.safeSearchAnnotation;
  if (!safeSearch) {
    throw new Error('No SafeSearch annotation in REST response');
  }

  return {
    adult: safeSearch.adult || 'UNKNOWN',
    spoof: safeSearch.spoof || 'UNKNOWN',
    medical: safeSearch.medical || 'UNKNOWN',
    violence: safeSearch.violence || 'UNKNOWN',
    racy: safeSearch.racy || 'UNKNOWN',
  };
};

module.exports = {
  getImageCaption,
  getImageLabels,
  getImageSafeSearch,
};
