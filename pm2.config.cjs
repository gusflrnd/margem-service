export default {
    apps : [{
      name   : 'gft-margem',
      script : 'src/server.js',
      instances: 1,
      autorestart: true,
      watch  : false,
      env: {
        NODE_ENV: 'production'
      }
    }]
  };
  