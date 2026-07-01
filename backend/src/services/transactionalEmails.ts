import { EmailDeliveryStatus, NotificationType, type Prisma, type PrismaClient } from '@prisma/client';
import * as nodemailer from 'nodemailer';

import { env, isProduction } from '../config/env';
import { logError, redactUrl } from '../utils/logging';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const EMAIL_PREFERENCES_PATH = '/profile?section=email-preferences';

type TransactionalEmailRecipient = {
  id?: string;
  email: string | null;
  name?: string | null;
  emailBookingUpdates?: boolean | null;
  emailSavedSearchUpdates?: boolean | null;
  emailMarketingUpdates?: boolean | null;
};

type TransactionalNotificationEmailInput = {
  recipients: TransactionalEmailRecipient[];
  type: NotificationType;
  title: string;
  message: string;
  bookingId?: string | null;
  actionPath?: string;
};

type UserNotificationEmailInput = Omit<
  TransactionalNotificationEmailInput,
  'recipients'
> & {
  userId: string;
};

type UsersNotificationEmailInput = Omit<
  TransactionalNotificationEmailInput,
  'recipients'
> & {
  userIds: string[];
};

function getFrontendBaseUrl() {
  const configuredUrl = env.FRONTEND_URL ?? env.CORS_ORIGIN[0];

  return configuredUrl.replace(/\/$/, '');
}

function shouldUseSmtpDelivery() {
  return (
    isProduction ||
    (env.NODE_ENV === 'development' && env.EMAIL_DELIVERY_MODE === 'smtp')
  );
}


function isMandatoryTransactionalEmail(type: NotificationType) {
  return (
    type === NotificationType.ACCOUNT_SECURITY ||
    type === NotificationType.VERIFICATION_STATUS_UPDATED ||
    type === NotificationType.REVIEW_STATUS_UPDATED ||
    type === NotificationType.RENT_PAYMENT_DUE ||
    type === NotificationType.TRANSACTION_STATUS_UPDATED ||
    type === NotificationType.BOOKING_PAYMENT_PAID ||
    type === NotificationType.BOOKING_PAYMENT_FAILED ||
    type === NotificationType.BOOKING_CANCELLATION_REQUESTED ||
    type === NotificationType.BOOKING_CANCELLED
  );
}

function isBookingEmail(type: NotificationType) {
  return (
    type === NotificationType.BOOKING_CREATED ||
    type === NotificationType.BOOKING_OWNER_APPROVED ||
    type === NotificationType.BOOKING_OWNER_REJECTED ||
    type === NotificationType.BOOKING_ADMIN_CONFIRMED
  );
}

function shouldDeliverEmailToRecipient(
  recipient: TransactionalEmailRecipient,
  type: NotificationType
) {
  if (isMandatoryTransactionalEmail(type)) return true;

  if (isBookingEmail(type)) {
    return recipient.emailBookingUpdates !== false;
  }

  if (type === NotificationType.SAVED_SEARCH_MATCH) {
    return recipient.emailSavedSearchUpdates !== false;
  }

  return true;
}

function getSmtpConfig() {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.MAIL_FROM) {
    throw new Error('SMTP email configuration is missing.');
  }

  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },
    from: env.MAIL_FROM
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getDefaultActionPath(input: {
  type: NotificationType;
  bookingId?: string | null;
}) {
  if (input.type === NotificationType.ACCOUNT_SECURITY) {
    return '/profile';
  }

  if (
    input.type === NotificationType.BOOKING_CREATED ||
    input.type === NotificationType.BOOKING_OWNER_APPROVED ||
    input.type === NotificationType.BOOKING_OWNER_REJECTED ||
    input.type === NotificationType.BOOKING_ADMIN_CONFIRMED ||
    input.type === NotificationType.BOOKING_CANCELLATION_REQUESTED ||
    input.type === NotificationType.BOOKING_CANCELLED ||
    input.type === NotificationType.BOOKING_PAYMENT_PAID ||
    input.type === NotificationType.BOOKING_PAYMENT_FAILED
  ) {
    return input.bookingId
      ? `/dashboard?booking=${encodeURIComponent(input.bookingId)}`
      : '/dashboard';
  }

  if (input.type === NotificationType.VERIFICATION_STATUS_UPDATED) {
    return '/notifications';
  }

  if (input.type === NotificationType.REVIEW_STATUS_UPDATED) {
    return '/notifications';
  }

  return '/notifications';
}

function getActionUrl(input: TransactionalNotificationEmailInput) {
  const actionPath =
    input.actionPath ??
    getDefaultActionPath({
      type: input.type,
      bookingId: input.bookingId
    });

  if (actionPath.startsWith('http://') || actionPath.startsWith('https://')) {
    return actionPath;
  }

  return `${getFrontendBaseUrl()}${actionPath.startsWith('/') ? '' : '/'}${actionPath}`;
}


function getEmailPreferencesUrl() {
  return `${getFrontendBaseUrl()}${EMAIL_PREFERENCES_PATH}`;
}

function getEmailPreferenceExplanation(type: NotificationType) {
  if (isMandatoryTransactionalEmail(type)) {
    return {
      label: 'Required account or transaction email',
      text:
        'You received this required email because it relates to account security, verification, trust and safety, payments, cancellations, or another important transaction update. Required emails cannot be disabled.'
    };
  }

  return {
    label: 'Optional notification email',
    text:
      'You received this optional notification email based on your lux.om email preferences. You can manage optional booking, saved-search, and marketing emails at any time.'
  };
}

function buildTransactionalEmail(input: {
  name: string | null | undefined;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  preferencesUrl: string;
}) {
  const safeName = input.name?.trim() || 'there';
  const escapedName = escapeHtml(safeName);
  const escapedTitle = escapeHtml(input.title);
  const escapedMessage = escapeHtml(input.message);
  const escapedActionUrl = escapeHtml(input.actionUrl);
  const escapedPreferencesUrl = escapeHtml(input.preferencesUrl);
  const preferenceExplanation = getEmailPreferenceExplanation(input.type);
  const escapedPreferenceLabel = escapeHtml(preferenceExplanation.label);
  const escapedPreferenceText = escapeHtml(preferenceExplanation.text);

  return {
    subject: `lux.om: ${input.title}`,
    text: [
      `Hi ${safeName},`,
      '',
      input.title,
      '',
      input.message,
      '',
      'Open this link to review the update:',
      input.actionUrl,
      '',
      `${preferenceExplanation.label}: ${preferenceExplanation.text}`,
      `Manage optional email preferences: ${input.preferencesUrl}`,
      '',
      'lux.om'
    ].join('\n'),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#07383e;max-width:620px">
        <p>Hi ${escapedName},</p>
        <h2 style="color:#07383e;margin:0 0 12px">${escapedTitle}</h2>
        <p>${escapedMessage}</p>
        <p>
          <a
            href="${escapedActionUrl}"
            style="display:inline-block;background:#07383e;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700"
          >
            Open update
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p style="word-break:break-all;color:#38585d">${escapedActionUrl}</p>
        <hr style="border:none;border-top:1px solid #d9e2e4;margin:24px 0" />
        <p style="font-size:13px;color:#557075;margin:0 0 8px">
          <strong>${escapedPreferenceLabel}</strong>
        </p>
        <p style="font-size:13px;color:#557075;margin:0 0 8px">${escapedPreferenceText}</p>
        <p style="font-size:13px;color:#557075;margin:0">
          Manage optional email preferences:
          <a href="${escapedPreferencesUrl}" style="color:#07383e;font-weight:700">
            ${escapedPreferencesUrl}
          </a>
        </p>
        <p>lux.om</p>
      </div>
    `
  };
}


function getEmailDeliveryMode() {
  return shouldUseSmtpDelivery() ? 'smtp' : 'dev';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;

  return 'Unknown email delivery error';
}

function getEmailSkipReasonForRecipient(
  recipient: TransactionalEmailRecipient,
  type: NotificationType
) {
  if (!recipient.email) {
    return 'Recipient does not have an email address.';
  }

  if (isMandatoryTransactionalEmail(type)) return null;

  if (isBookingEmail(type) && recipient.emailBookingUpdates === false) {
    return 'Recipient disabled optional booking email updates.';
  }

  if (
    type === NotificationType.SAVED_SEARCH_MATCH &&
    recipient.emailSavedSearchUpdates === false
  ) {
    return 'Recipient disabled saved-search email updates.';
  }

  return null;
}

async function recordEmailDeliveryEvent(
  db: DatabaseClient,
  input: {
    status: EmailDeliveryStatus;
    deliveryMode: string;
    notificationType: NotificationType;
    title: string;
    recipientUserId?: string | null;
    recipientEmail?: string | null;
    actionUrl?: string | null;
    preferencesUrl?: string | null;
    messageId?: string | null;
    reason?: string | null;
    errorMessage?: string | null;
  }
) {
  try {
    await db.emailDeliveryEvent.create({
      data: {
        status: input.status,
        deliveryMode: input.deliveryMode,
        notificationType: input.notificationType,
        title: input.title,
        recipientUserId: input.recipientUserId ?? null,
        recipientEmail: input.recipientEmail ?? null,
        actionUrl: input.actionUrl ?? null,
        preferencesUrl: input.preferencesUrl ?? null,
        messageId: input.messageId ?? null,
        reason: input.reason ?? null,
        errorMessage: input.errorMessage ?? null
      }
    });
  } catch (error) {
    logError('[lux.om] Failed to record email delivery event', error);
  }
}

async function safelyDeliverTransactionalNotificationEmail(
  db: DatabaseClient,
  input: TransactionalNotificationEmailInput
) {
  const actionUrl = getActionUrl(input);
  const preferencesUrl = getEmailPreferencesUrl();
  const deliveryMode = getEmailDeliveryMode();

  const skippedDeliveries = input.recipients
    .map((recipient) => ({
      recipient,
      reason: getEmailSkipReasonForRecipient(recipient, input.type)
    }))
    .filter((delivery) => Boolean(delivery.reason));

  await Promise.all(
    skippedDeliveries.map((delivery) =>
      recordEmailDeliveryEvent(db, {
        status: EmailDeliveryStatus.SKIPPED,
        deliveryMode,
        notificationType: input.type,
        title: input.title,
        recipientUserId: delivery.recipient.id ?? null,
        recipientEmail: delivery.recipient.email ?? null,
        actionUrl,
        preferencesUrl,
        reason: delivery.reason ?? 'Email delivery skipped.'
      })
    )
  );

  const recipients = input.recipients.filter(
    (recipient): recipient is TransactionalEmailRecipient & { email: string } =>
      Boolean(recipient.email) &&
      !getEmailSkipReasonForRecipient(recipient, input.type)
  );

  if (recipients.length === 0) return;

  if (!shouldUseSmtpDelivery()) {
    for (const recipient of recipients) {
      console.info(
        `[lux.om] Development transactional email for ${recipient.email}: ${input.title} -> ${redactUrl(actionUrl)} | preferences: ${redactUrl(preferencesUrl)}`
      );
    }

    await Promise.all(
      recipients.map((recipient) =>
        recordEmailDeliveryEvent(db, {
          status: EmailDeliveryStatus.LOGGED,
          deliveryMode,
          notificationType: input.type,
          title: input.title,
          recipientUserId: recipient.id ?? null,
          recipientEmail: recipient.email,
          actionUrl,
          preferencesUrl,
          reason: 'Development email delivery was logged instead of sent.'
        })
      )
    );

    return;
  }

  let smtpConfig: ReturnType<typeof getSmtpConfig>;

  try {
    smtpConfig = getSmtpConfig();
  } catch (error) {
    await Promise.all(
      recipients.map((recipient) =>
        recordEmailDeliveryEvent(db, {
          status: EmailDeliveryStatus.FAILED,
          deliveryMode,
          notificationType: input.type,
          title: input.title,
          recipientUserId: recipient.id ?? null,
          recipientEmail: recipient.email,
          actionUrl,
          preferencesUrl,
          errorMessage: getErrorMessage(error)
        })
      )
    );

    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: smtpConfig.auth
  });

  await Promise.all(
    recipients.map(async (recipient) => {
      const email = buildTransactionalEmail({
        name: recipient.name,
        type: input.type,
        title: input.title,
        message: input.message,
        actionUrl,
        preferencesUrl
      });

      try {
        const result = await transporter.sendMail({
          from: smtpConfig.from,
          to: recipient.email,
          subject: email.subject,
          text: email.text,
          html: email.html
        });

        await recordEmailDeliveryEvent(db, {
          status: EmailDeliveryStatus.SENT,
          deliveryMode,
          notificationType: input.type,
          title: input.title,
          recipientUserId: recipient.id ?? null,
          recipientEmail: recipient.email,
          actionUrl,
          preferencesUrl,
          messageId:
            typeof result.messageId === 'string' ? result.messageId : null
        });
      } catch (error) {
        await recordEmailDeliveryEvent(db, {
          status: EmailDeliveryStatus.FAILED,
          deliveryMode,
          notificationType: input.type,
          title: input.title,
          recipientUserId: recipient.id ?? null,
          recipientEmail: recipient.email,
          actionUrl,
          preferencesUrl,
          errorMessage: getErrorMessage(error)
        });
      }
    })
  );
}

export async function deliverTransactionalNotificationToUser(
  db: DatabaseClient,
  input: UserNotificationEmailInput
) {
  try {
    const user = await db.user.findUnique({
      where: {
        id: input.userId
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailBookingUpdates: true,
        emailSavedSearchUpdates: true,
        emailMarketingUpdates: true
      }
    });

    if (!user) return;

    await safelyDeliverTransactionalNotificationEmail(db, {
      ...input,
      recipients: [user]
    });
  } catch (error) {
    logError('[lux.om] Failed to deliver transactional notification email', error);
  }
}

export async function deliverTransactionalNotificationToUsers(
  db: DatabaseClient,
  input: UsersNotificationEmailInput
) {
  try {
    const uniqueUserIds = [...new Set(input.userIds)].filter(Boolean);

    if (uniqueUserIds.length === 0) return;

    const users = await db.user.findMany({
      where: {
        id: {
          in: uniqueUserIds
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailBookingUpdates: true,
        emailSavedSearchUpdates: true,
        emailMarketingUpdates: true
      }
    });

    await safelyDeliverTransactionalNotificationEmail(db, {
      ...input,
      recipients: users
    });
  } catch (error) {
    logError('[lux.om] Failed to deliver transactional notification emails', error);
  }
}
