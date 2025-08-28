module.exports = {
  routes: [
    {
      method: "POST",
      path: "/estimate",
      handler: "calculator.estimate",
      config: {
        auth: false
      }
    }
  ]
};
