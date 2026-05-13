// const redis = require("redis");
// const redisClient = redis.createClient({
//   socket: {
//     host: process.env.REDIS_HOST,
//     port: process.env.REDIS_PORT,
//   },
// });


// redisClient.on("error", (err) => console.error("Redis error:", err));



// (async () => {
//   await redisClient.connect();
//   console.log("Redis connected");
// })();

// const testing = async () => {
//   try {
//     // Set a key-value pair
//     await redisClient.set("testKey", "Hello, Redis!");

//     // Get the value of the key
//     const value = await redisClient.get("testKey");
//     console.log("Value from Redis:", value); // Should output: "Hello, Redis!"
//     await redisClient.del("testKey");
//     console.log("Key 'testKey' deleted.");

//     // Try to get the value again after deletion
//     const deletedValue = await redisClient.get("testKey");
//     console.log("Value from Redis after deletion:", deletedValue);
//   } catch (error:any) {
//     console.error("Error during Redis operation:", error);
//   } finally {
//     await redisClient.disconnect(); // Close the connection
//   }
// };

// // testing();

// // below line is for deployment usage
// // redis.ping().then(console.log).catch(console.error);


// module.exports = redisClient;
