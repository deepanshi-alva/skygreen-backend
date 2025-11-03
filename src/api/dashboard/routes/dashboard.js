module.exports = {
  routes: [
    {
      method: "GET",
      path: "/user-insights",
      handler: "dashboard.getUserInsights",
      config: {
        auth: false, // you can set true if needed
      },
    },
  ],
};
