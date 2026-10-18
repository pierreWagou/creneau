import { bookingMoveBlock, bookingSlotBlock, ctaButton, formatSlot, infoShell, tintBlock } from './blocks';
import { type InfoEmailResult, textFooter } from './shell';

export interface BookingMailDetails {
	spotNumber: string;
	flatNumber: string;
	startTime: string;
	endTime: string;
}

export function buildBookingConfirmationEmail(booking: BookingMailDetails, manageUrl: string): InfoEmailResult {
	const subject = `Réservation confirmée — Place ${booking.spotNumber}`;
	const slot = formatSlot(booking.startTime, booking.endTime);
	const guideUrl = `${new URL(manageUrl).origin}/guide`;
	const intro = 'La réservation suivante a été confirmée :';
	const text = `Bonjour,\n\n${intro}\n\nPlace : ${booking.spotNumber}\nCréneau : ${slot}\n\nLien vers votre réservation : ${manageUrl}\n\n—\nCréneau, votre place de parking partagée${textFooter(guideUrl)}`;
	const html = infoShell(
		'Réservation confirmée',
		intro,
		`${tintBlock(bookingSlotBlock(booking.spotNumber, booking.startTime, booking.endTime))}${ctaButton(manageUrl, 'Voir ma réservation')}`,
		guideUrl
	);
	return { subject, text, html };
}

export function buildBookingCancelledEmail(
	booking: BookingMailDetails,
	byOwner = false,
	guideUrl: string | null = null,
	manageUrl: string | null = null
): InfoEmailResult {
	const subject = `Réservation annulée — Place ${booking.spotNumber}`;
	const slot = formatSlot(booking.startTime, booking.endTime);
	// Single neutral voice for self and admin cancels (byOwner kept for signature stability).
	const intro = 'La réservation suivante a été annulée :';
	const linkText = manageUrl ? `\n\nLien vers votre réservation : ${manageUrl}` : '';
	const text = `Bonjour,\n\n${intro}\n\nPlace : ${booking.spotNumber}\nCréneau : ${slot}${linkText}\n\n—\nCréneau, votre place de parking partagée${textFooter(guideUrl)}`;
	const cta = manageUrl ? ctaButton(manageUrl, 'Voir ma réservation') : '';
	const html = infoShell(
		'Réservation annulée',
		intro,
		`${tintBlock(bookingSlotBlock(booking.spotNumber, booking.startTime, booking.endTime, true))}${cta}`,
		guideUrl
	);
	return { subject, text, html };
}

export function buildBookingMovedEmail(
	booking: BookingMailDetails,
	oldStartTime: string,
	oldEndTime: string,
	byOwner = false,
	guideUrl: string | null = null,
	manageUrl: string | null = null,
	oldSpotNumber: string | null = null
): InfoEmailResult {
	const subject = `Réservation modifiée — Place ${booking.spotNumber}`;
	const oldSlot = formatSlot(oldStartTime, oldEndTime);
	const newSlot = formatSlot(booking.startTime, booking.endTime);
	// Single neutral voice for self and admin moves (byOwner kept for signature stability).
	const intro = 'La réservation suivante a été modifiée :';
	const spotChanged = oldSpotNumber !== null && oldSpotNumber !== booking.spotNumber;
	const oldSpotText = spotChanged ? `\nAncienne place : ${oldSpotNumber}` : '';
	const linkText = manageUrl ? `\n\nLien vers votre réservation : ${manageUrl}` : '';
	const text = `Bonjour,\n\n${intro}\n\nAncien créneau : ${oldSlot}\nNouveau créneau : ${newSlot}\nPlace : ${booking.spotNumber}${oldSpotText}${linkText}\n\n—\nCréneau, votre place de parking partagée${textFooter(guideUrl)}`;
	const cta = manageUrl ? ctaButton(manageUrl, 'Voir ma réservation') : '';
	const html = infoShell(
		'Réservation modifiée',
		intro,
		`${tintBlock(bookingMoveBlock(booking.spotNumber, oldStartTime, oldEndTime, booking.startTime, booking.endTime, oldSpotNumber))}${cta}`,
		guideUrl
	);
	return { subject, text, html };
}
