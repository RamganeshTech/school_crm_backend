
// import jwt from "jsonwebtoken"
// import dotenv from "dotenv";
// import AccountantModel from "../Models/accountant.model.js";

// dotenv.config();

// const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY; // 15 minutes
// const REFRESH_TOKEN_EXPIRY =process.env.REFRESH_TOKEN_EXPIRY; // 7 days

// // ✅ Generate Access & Refresh Tokens
// const generateTokens = async (role, id) => {
//   let accessToken=""

//   if(role==="accountant"){

//     let isExists = await AccountantModel.findById(id)
//      accessToken = jwt.sign({ _id:isExists._id,role }, process.env.JWT_SECRET!!, {
//       expiresIn: ACCESS_TOKEN_EXPIRY,
//     });
//     console.log(accessToken)
//   }
//   else{
//     accessToken = jwt.sign({ role }, process.env.JWT_SECRET!!, {
//       expiresIn: ACCESS_TOKEN_EXPIRY,
//     });
//   }

  
//   const refreshToken = jwt.sign(
//     { role },
//     process.env.REFRESH_SECRET,
//     { expiresIn: REFRESH_TOKEN_EXPIRY }
//   );
//   return { accessToken, refreshToken };
// };

// // ✅ Verify Access Token, can be used in middlewares for protected Routes
// const verifyAccessToken = (token) => {
//   try {
//     return jwt.verify(token, process.env.JWT_SECRET!);
//   } catch (error:any) {
//     return null;
//   }
// };

// // ✅ Verify Refresh Token
// const verifyRefreshToken = (token) => {
//   try {
//     return jwt.verify(token, process.env.REFRESH_SECRET);
//   } catch (error:any) {
//     return null;
//   }
// };

// // module.exports = { generateTokens, verifyAccessToken, verifyRefreshToken };
// export {generateTokens, verifyAccessToken, verifyRefreshToken}
