const admin = require("firebase-admin");
const serviceAccount = require("./b4-styles-firebase-service-key.json");

admin.initializeApp({
     credential: admin.credential.cert(serviceAccount)
})

module.exports = admin
