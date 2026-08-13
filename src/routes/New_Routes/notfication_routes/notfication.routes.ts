// routes/notificationRoutes.ts
import { Router } from 'express';
import { createNotification,
getAllNotifications,
getSingleNotification,
deleteNotification, 
markAllNotificationsAsRead,
markNotificationAsRead,
getUnreadNotificationCount} from '../../../controllers/New_Controllers/notification_controller/notfication.controller.js';
import { multiRoleAuth } from '../../../middleware/multiRoleRequest.js';

// Import your authentication middleware here
// import { verifyToken } from '../middlewares/authMiddleware.js'; 

const notficationRoutes = Router();

// Apply auth middleware to all notification routes so req.user is populated
// router.use(verifyToken); 

// Create a new notification
// notficationRoutes.post('/', multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), createNotification);

// Get all notifications (paginated & role-filtered)
notficationRoutes.get('/', multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), getAllNotifications);

notficationRoutes.get('/unread-count', multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), getUnreadNotificationCount);

// Get a single notification by ID (marks it as read for the user)
notficationRoutes.get('/:id', multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), getSingleNotification);

// Delete a notification by ID
notficationRoutes.delete('/:id', multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), deleteNotification);

notficationRoutes.patch('/mark-all-read', multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), markAllNotificationsAsRead);
notficationRoutes.patch('/mark-read/:id', multiRoleAuth("correspondent", "administrator", "principal", "parent", "accountant", "viceprincipal", "teacher"), markNotificationAsRead);

export default notficationRoutes;