module.exports = {
  apps: [
    {
      name: "tiranga-id-card",
      script: "./dist/server.cjs",
      instances: process.platform === "win32" ? 1 : 1,
      exec_mode: process.platform === "win32" ? "fork" : "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};