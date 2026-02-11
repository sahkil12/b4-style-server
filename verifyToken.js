const admin = require("./firebaseAdmin")

const verifyToken = async (req, res, next) => {
   const authHeader = req.headers.authorization;

   if(!authHeader){
     return res.status(401).send({ message: "Unauthorized" });
   }

   const token = authHeader.split(" ")[1]

   try {
     const decoded = await admin.auth().verifyIdToken(token)
     req.user = decoded
     next()
   }
   catch(error){
      return res.status(403).send({ message: "Forbidden" });
   }
}

module.exports = verifyToken;