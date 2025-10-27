module.exports = {
    routes: [
      {
       method: 'POST',
       path: '/validateToken',
       handler: 'authentication.validateToken',
      },
      {
        method: 'POST', 
        path: '/verify-token',
        handler: 'authentication.verifyToken', 
      },
      {
        method: 'POST', 
        path: '/reset-password',
        handler: 'authentication.customResetPassword', 
      },
    ],
  };
