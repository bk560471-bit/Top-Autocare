const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const cors = require('cors');
const puppeteer = require('puppeteer');

// Initialize Firebase Admin (for Firestore access)
admin.initializeApp();

const nodemailerTransporter = nodemailer.createTransport({
  service: 'gmail', // Or 'SendGrid', etc. Update in .env
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const twilioClient = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN); // Optional SMS

// Middleware for HTTPS functions (CORS)
const corsHandler = cors({ origin: true });

// =============================================================================
// 1. On Appointment Creation (Firestore Trigger)
// =============================================================================

exports.createAppointment = functions.firestore
  .document('appointments/{appointmentId}')
  .onCreate(async (snap, context) => {
    const appointment = snap.data();
    const appointmentId = context.params.appointmentId;
    const { userId, email, phone, service, date, status } = appointment;

    if (!userId || status !== 'pending') return null;

    try {
      // Update appointment with server timestamp
      await snap.ref.update({ createdAt: admin.firestore.FieldValue.serverTimestamp() });

      // Get user details
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      const fullName = userData?.fullName || 'Customer';

      // Send email confirmation
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: `Appointment #${appointmentId} - Confirmation | Top Autocare`,
        html: `
          <h2>Hi ${fullName},</h2>
          <p>Your appointment for <strong>${service}</strong> on <strong>${date}</strong> has been booked!</p>
          <p>Status: ${status}. We'll notify you if approved.</p>
          <p>Track it: <a href="https://top-autocare.com/dashboard.html">Dashboard</a></p>
          <p>Questions? Call +254 757 562 447</p>
          <hr>
          <small>Top Autocare Garage, Nairobi, Kenya</small>
        `,
      };
      await nodemailerTransporter.sendMail(mailOptions);

      // Optional SMS (Twilio)
      if (phone && process.env.TWILIO_SID) {
        await twilioClient.messages.create({
          body: `Top Autocare: Your ${service} appointment on ${date} is booked! Check email.`,
          from: process.env.TWILIO_PHONE,
          to: phone,
        });
      }

      // Log to notifications collection
      await admin.firestore().collection('notifications').add({
        userId,
        type: 'appointment',
        title: 'Appointment Booked',
        message: `Your ${service} on ${date} is pending approval.`,
        data: { appointmentId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

      console.log(`Appointment ${appointmentId} confirmed for ${email}`);
      return { success: true };

    } catch (error) {
      console.error('Error in createAppointment:', error);
      functions.logger.error('Appointment creation failed:', error);
      return null;
    }
  });

// =============================================================================
// 2. Approve/Reject Appointment (HTTPS Function - Admin Call)
// =============================================================================

exports.approveAppointment = functions.https.onRequest((req, res) => {
  return corsHandler(req, res, async () => {
    const { appointmentId, action } = req.body; // action: 'approve' or 'reject'
    const idToken = req.headers.authorization?.replace('Bearer ', '');

    if (!appointmentId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      // Verify admin token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const userDoc = await admin.firestore().collection('users').doc(uid).get();
      
      if (userDoc.data()?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Update appointment status
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const updateData = {
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // If approved, add admin notes or schedule
      if (action === 'approve') {
        updateData.adminNotes = req.body.adminNotes || '';
      }

      await admin.firestore().collection('appointments').doc(appointmentId).update(updateData);

      // Get user for notification
      const appointmentDoc = await admin.firestore().collection('appointments').doc(appointmentId).get();
      const appointment = appointmentDoc.data();
      const userId = appointment.userId;
      const userDocUser = await admin.firestore().collection('users').doc(userId).get();
      const userEmail = userDocUser.data()?.email;
      const userPhone = userDocUser.data()?.phone;
      const fullName = userDocUser.data()?.fullName || 'Customer';

      // Send notification email
      const statusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: userEmail,
        subject: `Appointment #${appointmentId} - ${statusText} | Top Autocare`,
        html: `
          <h2>Hi ${fullName},</h2>
          <p>Your ${appointment.service} on ${appointment.date} has been ${newStatus}.</p>
          <p>Details: ${action === 'approve' ? 'Confirmed! See you soon.' : 'We\'ll reschedule.'}</p>
          <p>Track: <a href="https://top-autocare.com/dashboard.html">Dashboard</a></p>
          <p>+254 757 562 447</p>
        `,
      };
      await nodemailerTransporter.sendMail(mailOptions);

      // Optional SMS
      if (userPhone && process.env.TWILIO_SID) {
        const smsBody = `Top Autocare: Your appointment ${appointmentId} ${action}ed for ${appointment.date}.`;
        await twilioClient.messages.create({
          body: smsBody,
          from: process.env.TWILIO_PHONE,
          to: userPhone,
        });
      }

      // Add to notifications
      await admin.firestore().collection('notifications').add({
        userId,
        type: 'appointment',
        title: `${statusText} Update`,
        message: `Your appointment has been ${newStatus}.`,
        data: { appointmentId, action },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
      });

      res.json({ success: true, message: `Appointment ${action}ed` });

    } catch (error) {
      console.error('Error in approveAppointment:', error);
      if (error.code === 'auth/invalid-id-token') {
        res.status(401).json({ error: 'Invalid token' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });
});

// =============================================================================
// 3. Send Bulk Notification (Admin HTTPS - Promotions/Reminders)
// =============================================================================

exports.sendBulkNotification = functions.https.onRequest((req, res) => {
  return corsHandler(req, res, async () => {
    const { title, message, type, targetRole = 'user' } = req.body;
    const idToken = req.headers.authorization?.replace('Bearer ', '');

    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      const userDoc = await admin.firestore().collection('users').doc(uid).get();

      if (userDoc.data()?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
      }

      // Query users (all or specific role)
      const usersQuery = admin.firestore().collection('users').where('role', '==', targetRole);
      const usersSnapshot = await usersQuery.get();
      const notificationsSent = [];

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();
        const email = userData.email;

        // Create notification in Firestore
        await admin.firestore().collection('notifications').add({
          userId,
          type: type || 'promotion',
          title,
          message,
          data: { action: 'read' },
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          read: false,
        });

        // Send email
        const mailOptions = {
          from: process.env.GMAIL_USER,
          to: email,
          subject: `${title} | Top Autocare`,
          html: `<h2>${title}</h2><p>${message}</p><p><a href="https://top-autocare.com/dashboard.html">View All</a></p>`,
        };
        await nodemailerTransporter.sendMail(mailOptions);

        notificationsSent.push(userId);
      }

      res.json({ success: true, sentTo: notificationsSent.length });

    } catch (error) {
      console.error('Error in sendBulkNotification:', error);
      res.status(500).json({ error: 'Failed to send notifications' });
    }
  });
});

// =============================================================================
// 4. Generate User Report (Admin HTTPS - PDF/Email Report)
// =============================================================================

exports.generateUserReport = functions.https.onRequest((req, res) => {
  return corsHandler(req, res, async () => {
    const { userId, startDate, endDate } = req.body;
    const idToken = req.headers.authorization?.replace('Bearer ', '');

    if (!idToken) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      if (admin.firestore().collection('users').doc(decodedToken.uid).get().data()?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
      }

      // Fetch user data (profile + appointments)
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      if (!userData) return res.status(404).json({ error: 'User not found' });

      const appointmentsQuery = admin.firestore()
        .collection('appointments')
        .where('userId', '==', userId)
        .orderBy('date', 'desc')
        .limit(50); // Recent 50
      const appointments = (await appointmentsQuery.get()).docs.map(doc => doc.data());

      // Generate PDF with Puppeteer
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      const html = `
        <html>
          <head><style>body { font-family: Arial; } table { border-collapse: collapse; } th, td { border: 1px solid #ddd; padding: 8px; }</style></head>
          <body>
            <h1>User Report: ${userData.fullName}</h1>
            <p>Email: ${userData.email} | Phone: ${userData.phone} | Joined: ${userData.createdAt?.toDate().toLocaleDateString()}</p>
            <h2>Recent Appointments (${appointments.length})</h2>
            <table>
              <tr><th>ID</th><th>Service</th><th>Date</th><th>Status</th></tr>
              ${appointments.map(a => `<tr><td>${a.appointmentId || 'N/A'}</td><td>${a.service}</td><td>${a.date}</td><td>${a.status}</td></tr>`).join('')}
            </table>
          </body>
        </html>
      `;
      await page.setContent(html);
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();

      // Email PDF
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: userData.email,
        subject: `User Report for ${userData.fullName}`,
        attachments: [{ filename: 'report.pdf', content: pdfBuffer }],
        html: `<h2>Report Attached</h2><p>Your activity summary is attached.</p>`,
      };
      await nodemailerTransporter.sendMail(mailOptions);

      res.json({ success: true, message: 'Report generated and emailed' });

    } catch (error) {
      console.error('Error in generateUserReport:', error);
      res.status(500).json({ error: 'Report generation failed' });
    }
  });
});
