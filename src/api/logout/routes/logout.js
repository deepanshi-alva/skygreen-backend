module.exports = {
  routes: [
    {
      method: "POST",
      path: "/logout",
      handler: "logout.handleLogout",
      config: { auth: false },
    },
  ],
};
