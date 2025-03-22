require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin");
const app = express();
const PORT = process.env.PORT || 5000;

//const cors = require('cors');

// Enable CORS for all origins or just localhost
app.use(
  cors({
    origin: "http://localhost:3000", // You can also set it to '*' to allow all origins, but this is not recommended for production
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      // "Authorization",
      "ngrok-skip-browser-warning",
    ],
  })
);

//app.use(cors());
//app.use(express.json());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const SD_API_URL = "http://127.0.0.1:7860";

const serviceAccount = require("./service-account-private-key-firebase-realtime-db.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://interior-design-generato-55995-default-rtdb.firebaseio.com",
});

const db = admin.database();

// Proxy to Local Stable Diffusion API
// app.post("/generate", async (req, res) => {
//   try {
//     const response = await axios.post(
//       "http://127.0.0.1:7860/sdapi/v1/txt2img",
//       req.body
//     );
//     res.json(response.data);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

app.post("/generate", async (req, res) => {
  console.log("Generate request sent from client to server : " + req.body);
  try {
    const response = await axios.post(
      `${SD_API_URL}/sdapi/v1/txt2img`,
      req.body,
      {
        headers: { "ngrok-skip-browser-warning": "true" }, // Add this header
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/scribble", async (req, res) => {
  try {
    const payload = {
      prompt: req.body.prompt || "",
      negative_prompt: req.body.negative_prompt || "",
      width: req.body.width,
      height: req.body.height,
      steps: req.body.steps,
      cfg_scale: req.body.cfg_scale || 7,
      sampler_name: req.body.sampler_name || "DPM++ 2M", // Fixed sampler name
      alwayson_scripts: {
        controlnet: {
          args: [
            {
              enabled: true,
              image: req.body.input_image,
              module: "invert",
              model: "control_v11p_sd15_scribble",
            },
          ],
        },
      },
    };

    const response = await axios.post(
      `${SD_API_URL}/sdapi/v1/txt2img`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    res.status(500).json({ error: "Generation failed" });
  }
});

app.post("/depth", async (req, res) => {
  try {
    // Ensure single image input
    const initImage = Array.isArray(req.body.init_images)
      ? req.body.init_images[0]
      : req.body.init_image;

    const payload = {
      prompt: req.body.prompt || "snowy background outside the windows", // Specific localized change
      init_images: [initImage],
      denoising_strength: req.body.denoising_strength || 0.75,
      cfg_scale: req.body.cfg_scale || 7,
      steps: req.body.steps || 20,
      sampler_name: req.body.sampler_name || "DPM++ 2M", // Better for subtle edits
      alwayson_scripts: {
        controlnet: {
          args: [
            {
              enabled: true,
              image: initImage, // Single base64 string
              module: "depth_midas",
              model: "control_v11f1p_sd15_depth",
              weight: req.body.weight || 1.0, // Higher weight preserves structure
              control_mode: "Balanced", // Prioritize depth map
              processor_res: req.body.width || 512, // Match input resolution
            },
          ],
        },
      },
    };

    const response = await axios.post(
      `${SD_API_URL}/sdapi/v1/img2img`,
      payload,
      { headers: { "Content-Type": "application/json" } }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Depth Error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to modify image",
      details: error.response?.data?.error || error.message,
    });
  }
});

// app.post("/depth", async (req, res) => {
//   try {
//     const payload = {
//       prompt: req.body.prompt || "",
//       negative_prompt: req.body.negative_prompt || "",
//       width: req.body.width,
//       height: req.body.height,
//       steps: req.body.steps || 20,
//       cfg_scale: req.body.cfg_scale || 7,
//       denoising_strength: req.body.denoising_strength || 0.75, // Crucial for img2img
//       sampler_name: req.body.sampler_name || "DPM++ 2M",
//       init_images: req.body.init_images, // Base64 of source image
//       alwayson_scripts: {
//         controlnet: {
//           args: [
//             {
//               enabled: true,
//               image: req.body.init_images, // Base64 depth map
//               module: "depth_midas", // Use "depth_midas" if you need auto-depth
//               model: "control_v11f1p_sd15_depth", // Depth model
//               control_mode: "Balanced",
//               processor_res: 512, // Resolution for depth processing
//             },
//           ],
//         },
//       },
//     };

//     const response = await axios.post(
//       `${SD_API_URL}/sdapi/v1/img2img`, // Changed to img2img endpoint
//       payload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "ngrok-skip-browser-warning": "true",
//         },
//       }
//     );

//     res.json(response.data);
//   } catch (error) {
//     console.error("Depth Error:", error.response?.data || error.message);
//     res.status(500).json({ error: "Depth processing failed" });
//   }
// });

// app.post("/depth", async (req, res) => {
//   //console.log("Depth request sent from client to server : " + req.body);
//   try {
//     const payload = {
//       prompt: req.body.prompt || "",
//       init_images: req.body.init_images,
//       negative_prompt: req.body.negative_prompt || "",
//       width: req.body.width,
//       height: req.body.height,
//       steps: req.body.steps || 20,
//       cfg_scale: req.body.cfg_scale || 7,
//       sampler_name: req.body.sampler_name || "DPM++ 2M", // Fixed sampler name
//       alwayson_scripts: {
//         controlnet: {
//           args: [
//             {
//               enabled: true,
//               image: req.body.init_images,
//               module: "depth_midas",
//               model: "control_v11f1p_sd15_depth",
//             },
//           ],
//         },
//       },
//     };

//     const response = await axios.post(
//       `${SD_API_URL}/sdapi/v1/img2img`,
//       payload,
//       {
//         headers: {
//           "Content-Type": "application/json",
//           "ngrok-skip-browser-warning": "true",
//         },
//       }
//     );

//     res.json(response.data);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get("/progress", async (req, res) => {
//   try {
//     const response = await axios.get("http://127.0.0.1:7860/sdapi/v1/progress");
//     res.json({
//       progress: response.data.progress, // Real progress from Stable Diffusion
//       eta: response.data.eta_relative, // Estimated time remaining
//       completed: response.data.progress >= 1.0,
//     });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get("/progress", async (req, res) => {
//   try {
//     const response = await axios.get("http://127.0.0.1:7860/sdapi/v1/progress");
//     res.json(response.data);
//   } catch (error) {
//     res.status(500).json({ error: "Error fetching progress" });
//   }
// });

app.get("/progress", async (req, res) => {
  console.log("Progress request sent from client to server : " + req.body);
  try {
    const response = await axios.get(`${SD_API_URL}/sdapi/v1/progress`, {
      headers: { "ngrok-skip-browser-warning": "true" }, // Add this header
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// app.get("/ngrok-url", async (req, res) => {
//   try {
//     const response = await axios.get("http://127.0.0.1:4040/api/tunnels");
//     const tunnels = response.data.tunnels;
//     if (tunnels.length > 0) {
//       const ngrokUrl = tunnels[0].public_url;
//       console.log("Returning ngrok URL:", ngrokUrl);
//       return res.json({ ngrokUrl });
//     } else {
//       return res.status(404).json({ error: "No active tunnels found." });
//     }
//   } catch (error) {
//     console.error("Error fetching ngrok URL:", error.message);
//     return res.status(500).json({ error: "Internal server error" });
//   }
// });

// Function to fetch ngrok URL and update Firebase
async function updateNgrokUrl() {
  try {
    //const response = await axios.get("http://127.0.0.1:4040/api/tunnels");
    const response = await axios.get("http://127.0.0.1:4040/api/tunnels");
    const tunnels = response.data.tunnels;
    if (tunnels && tunnels.length > 0) {
      const publicUrl = tunnels[0].public_url;
      console.log("Fetched ngrok URL:", publicUrl);
      // Update the value in Firebase under the key 'ngrokUrl'
      await db.ref("ngrokUrl").set(publicUrl);
      console.log("Firebase updated with ngrok URL");
    } else {
      console.log("No active tunnels found.");
    }
  } catch (error) {
    console.error("Error fetching ngrok URL:", error.message);
  }
}

// Call the update function when index.js starts
//updateNgrokUrl();

// app.post("/img2img", async (req, res) => {
//   try {
//     const response = await axios.post(
//       `${SD_API_URL}/sdapi/v1/img2img`,
//       req.body, // Expecting image data & parameters in the request
//       {
//         headers: { "ngrok-skip-browser-warning": "true" },
//       }
//     );
//     res.json(response.data);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post("/inpaint", async (req, res) => {
//   try {
//     const { init_images, mask, ...otherParams } = req.body;

//     if (
//       !init_images ||
//       !Array.isArray(init_images) ||
//       init_images.length === 0
//     ) {
//       return res
//         .status(400)
//         .json({ error: "init_images is required and must be an array." });
//     }

//     const payload = {
//       init_images, // Base64-encoded image array
//       mask: mask || "", // Optional: Base64-encoded mask
//       inpainting_fill: mask ? req.body.inpainting_fill || 1 : undefined, // Set inpainting_fill only if mask exists
//       ...otherParams, // Other img2img parameters (like denoising_strength, steps, width, height, etc.)
//     };

//     const response = await axios.post(
//       `${SD_API_URL}/sdapi/v1/img2img`,
//       payload,
//       {
//         headers: { "ngrok-skip-browser-warning": "true" },
//       }
//     );

//     res.json(response.data);
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

app.post("/inpaint", async (req, res) => {
  console.log("Inpaint request sent from client to server : " + req.body);
  try {
    const { init_images, mask, ...otherParams } = req.body;

    if (
      !init_images ||
      !Array.isArray(init_images) ||
      init_images.length === 0
    ) {
      return res
        .status(400)
        .json({ error: "init_images is required and must be an array." });
    }

    const payload = {
      init_images,
      mask: mask || "",
      inpainting_fill: mask ? req.body.inpainting_fill || 1 : undefined,
      ...otherParams,
    };

    const response = await axios.post(
      `${SD_API_URL}/sdapi/v1/img2img`,
      payload,
      {
        headers: { "ngrok-skip-browser-warning": "true" },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
