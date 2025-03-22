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
    origin: "http://localhost:3000",
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

// app.post("/generate", async (req, res) => {
//   console.log("Generate request sent from client to server : " + req.body);
//   try {
//     const response = await axios.post(
//       `${SD_API_URL}/sdapi/v1/txt2img`,
//       req.body,
//       {
//         headers: { "ngrok-skip-browser-warning": "true" }, // Add this header
//       }
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
      {
        prompt: req.body.prompt || "",
        negative_prompt: req.body.negative_prompt || "",
        width: req.body.width,
        height: req.body.height,
        steps: req.body.steps || 20,
        cfg_scale: req.body.cfg_scale || 7,
        sampler_name: req.body.sampler_name || "DPM++ 2M", // Fixed sampler name
        scheduler: req.body.scheduler || "Automatic",
        override_settings: {
          sd_model_checkpoint:
            req.body.override_settings.sd_model_checkpoint ||
            "xsarchitectural_v11.ckpt",
        },
      },
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
      steps: req.body.steps || 20,
      cfg_scale: req.body.cfg_scale || 7,
      sampler_name: req.body.sampler_name || "DPM++ 2M", // Fixed sampler name
      scheduler: req.body.scheduler || "Automatic",

      alwayson_scripts: {
        controlnet: {
          args: [
            {
              enabled: true,
              image: req.body.input_image,
              module: "invert",
              model: "control_v11p_sd15_scribble",
              weight: req.body.weight || 1.0,
              lowvram: req.body.lowvram || false,
              guidance_start: req.body.guidance_start || 0.0,
              guidance_end: req.body.guidance_end || 1.0,
              pixel_perfect: req.body.pixel_perfect || false,
              resize_mode: req.body.resize_mode || "Scale to Fit (Inner Fit)",
              control_mode: req.body.control_mode || "Balanced",
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
      negative_prompt: req.body.negative_prompt || "",
      resize_mode: req.body.resize_mode || 0,
      width: req.body.width,
      height: req.body.height,

      init_images: [initImage],
      denoising_strength: req.body.denoising_strength || 0.75,
      cfg_scale: req.body.cfg_scale || 7,
      steps: req.body.steps || 20,
      sampler_name: req.body.sampler_name || "DPM++ 2M", // Better for subtle edits
      scheduler: req.body.scheduler || "Automatic",
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
              lowvram: req.body.lowvram || false,
              pixel_perfect: req.body.pixel_perfect || false,
              guidance_start: req.body.guidance_start || 0.0,
              guidance_end: req.body.guidance_end || 1.0,
              resize_mode: req.body.resize_mode || "Scale to Fit (Inner Fit)",
              control_mode: req.body.control_mode || "Balanced",
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
updateNgrokUrl();

// app.post("/inpaint", async (req, res) => {
//   console.log("Inpaint request sent from client to server : " + req.body);
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
//       init_images,
//       mask: mask || "",
//       inpainting_fill: mask ? req.body.inpainting_fill || 1 : undefined,
//       ...otherParams,
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
    // const { init_images, mask, ...otherParams } = req.body;

    // if (
    //   !init_images ||
    //   !Array.isArray(init_images) ||
    //   init_images.length === 0
    // ) {
    //   return res
    //     .status(400)
    //     .json({ error: "init_images is required and must be an array." });
    // }

    const initImage = req.body.init_images;

    if (!initImage || !Array.isArray(initImage) || initImage.length === 0) {
      return res
        .status(400)
        .json({ error: "init_images is required and must be an array." });
    }

    // const payload = {
    //   init_images,
    //   mask: mask || "",
    //   inpainting_fill: mask ? req.body.inpainting_fill || 1 : undefined,
    //   ...otherParams,
    // };

    const payload = {
      init_images: initImage,
      mask: req.body.mask,
      prompt: req.body.prompt,
      negative_prompt: req.body.negative_prompt,
      steps: req.body.steps,
      sampler_name: req.body.sampler_name,
      scheduler: req.body.scheduler,
      denoising_strength: req.body.denoising_strength,
      cfg_scale: req.body.cfg_scale,
      width: req.body.width,
      height: req.body.height,
      resize_mode: req.body.resize_mode,
      mask_blur: req.body.mask_blur,
      mask_mode: req.body.mask_mode,
      inpainting_fill: req.body.inpainting_fill,
      inpaint_area: req.body.inpaint_area,
      inpaint_full_res_padding: req.body.inpaint_full_res_padding,
      inpainting_mask_invert: req.body.inpainting_mask_invert,
      soft_inpainting: req.body.soft_inpainting,
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
