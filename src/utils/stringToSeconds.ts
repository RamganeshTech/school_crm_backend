const parseExpiry = (expiry) => {
    const timeValue = parseInt(expiry);
    if (expiry.includes("d")) return timeValue * 86400; // Convert days to seconds
    if (expiry.includes("h")) return timeValue * 3600;  // Convert hours to seconds
    if (expiry.includes("m")) return timeValue * 60;    // Convert minutes to seconds
    return timeValue; // Default (already in seconds)
  };

// module.exports = {
//     parseExpiry
// }

export {
  parseExpiry
}