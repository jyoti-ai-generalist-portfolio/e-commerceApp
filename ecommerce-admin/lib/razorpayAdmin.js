// Razorpay client for the admin app (the customer app's razorpayServer.js lives in a different workspace package).
import Razorpay from 'razorpay';

let client;
export function getRazorpay() {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}
