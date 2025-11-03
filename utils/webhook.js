import crypto from 'crypto';

export const afsWebhook = async (req, res) => {
  try {
    const rawBody = req.body; 
    const encrypted = req.headers['x-afs-encrypted-data'];
    const iv = req.headers['x-afs-iv'];

    // 🔐 Decrypt using the key AFS gave you
    const key = Buffer.from(process.env.AFS_WEBHOOK_ENCRYPTION_KEY, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'base64'));

    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    const payload = JSON.parse(decrypted);

    console.log('📩 Webhook received:', payload);

    // Process success/failure
    if (payload.result?.code?.startsWith('000.000.')) {
      await BookingModel.findByIdAndUpdate(payload.merchantTransactionId, {
        paymentStatus: 'confirmed',
        bookingStatus: 'confirmed',
      });
    } else {
      await BookingModel.findByIdAndUpdate(payload.merchantTransactionId, {
        paymentStatus: 'failed',
        bookingStatus: 'cancelled',
      });
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('💥 Webhook Error:', err.message);
    res.sendStatus(400);
  }
};
