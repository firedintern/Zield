module.exports = {
  apps: [
    {
      name: "zield-keeper",
      script: "npm",
      args: "run dev",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm Z",
      merge_logs: true,
    },
  ],
};
