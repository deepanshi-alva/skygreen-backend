"use strict";
module.exports = {
    routes: [
        {
            method: "POST",
            path: "/auth/send-otp",
            handler: "custome-otp.sendOtpOnEmail",
            config: {
                auth: false, // Set to true if authentication is required
            },
        },
        {
            method: "POST",
            path: "/auth/verify-otp",
            handler: "custome-otp.verifyOtp",
            config: {
                auth: false, // Set to true if authentication is required
            },
        },
    ],
}