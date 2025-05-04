const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080; // Gunakan port dari environment atau default 8080

// Tentukan laluan ke direktori binaan frontend
const frontendBuildPath = path.join(__dirname, 'frontend', 'dist');

// Hidangkan fail statik dari direktori binaan frontend
app.use(express.static(frontendBuildPath));

// Fallback untuk semua laluan GET yang tidak dikenali (untuk React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).send(err);
    }
  });
});

// Mulakan pelayan
app.listen(PORT, () => {
  console.log(`Production server running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${frontendBuildPath}`);
}); 