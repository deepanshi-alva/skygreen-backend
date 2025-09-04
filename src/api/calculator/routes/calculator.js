module.exports = {
  routes: [
    {
      method: "POST",
      path: "/calculator/estimate",
      handler: "calculator.estimate",
      config: {
        auth: false
      }
    }
  ]
};
