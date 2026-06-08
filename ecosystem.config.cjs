module.exports = {
  apps: [
    {
      name: 'packhub',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'server/index.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
        MAX_UPLOAD_MB: process.env.MAX_UPLOAD_MB || 1024,
      },
      max_memory_restart: '512M',
      autorestart: true,
      watch: false,
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
