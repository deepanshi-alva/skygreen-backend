const axios = require("axios");

module.exports = async function verifyRecaptcha(token) {
  const secret = "6LcDp9QrAAAAAFjaT_E_iVMmVwt4-4hBEGFaDtyR";
  console.log("i got the token here", token);
  try {
    const res = await axios.post(
      "https://www.google.com/recaptcha/api/siteverify",
      {},
      { params: { secret, response: token } }
    );
    console.log("this is the success measurement", res.data.success, " , this is the score: ", res.data.score);
    console.log("full response from Google:", res.data);

    return res.data.success && res.data.score > 0.5; // adjust threshold if needed
  } catch (err) {
    console.error("reCAPTCHA verify error:", err.message);
    return false;
  }
};
