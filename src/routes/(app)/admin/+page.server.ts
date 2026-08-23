import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	flat,
	flatEmail,
	flatPhone,
	request,
	requestEmail,
	requestPhone,
	requestSpot,
	spot
} from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.flat?.isAdmin) {
		throw redirect(302, '/calendar');
	}

	// Load flats
	const flats = await db
		.select({
			number: flat.number,
			status: flat.status,
			activationCode: flat.activationCode,
			activationCodeExpiresAt: flat.activationCodeExpiresAt,
			displayName: flat.displayName,
			isAdmin: flat.isAdmin,
			activatedAt: flat.activatedAt,
			createdAt: flat.createdAt
		})
		.from(flat)
		.orderBy(flat.number)
		.all();

	// Load pending requests
	const pendingRequests = await db.select().from(request).where(eq(request.status, 'pending')).all();

	// Load spots
	const spots = await db.select().from(spot).all();

	// Load contacts for flats
	const allFlatEmails = await db.select().from(flatEmail).all();
	const allFlatPhones = await db.select().from(flatPhone).all();

	const flatEmailsByFlat = new Map<string, string[]>();
	const flatPhonesByFlat = new Map<string, string[]>();

	for (const row of allFlatEmails) {
		const list = flatEmailsByFlat.get(row.flatNumber) ?? [];
		list.push(row.email);
		flatEmailsByFlat.set(row.flatNumber, list);
	}

	for (const row of allFlatPhones) {
		const list = flatPhonesByFlat.get(row.flatNumber) ?? [];
		list.push(row.phone);
		flatPhonesByFlat.set(row.flatNumber, list);
	}

	const flatsWithContacts = flats.map((f) => ({
		...f,
		emails: flatEmailsByFlat.get(f.number) ?? [],
		phones: flatPhonesByFlat.get(f.number) ?? []
	}));

	// Load contacts and spots for requests
	const allReqEmails = await db.select().from(requestEmail).all();
	const allReqPhones = await db.select().from(requestPhone).all();
	const allReqSpots = await db.select().from(requestSpot).all();

	const reqEmailsByReq = new Map<number, string[]>();
	const reqPhonesByReq = new Map<number, string[]>();
	const reqSpotsByReq = new Map<number, string[]>();

	for (const row of allReqEmails) {
		const list = reqEmailsByReq.get(row.requestId) ?? [];
		list.push(row.email);
		reqEmailsByReq.set(row.requestId, list);
	}

	for (const row of allReqPhones) {
		const list = reqPhonesByReq.get(row.requestId) ?? [];
		list.push(row.phone);
		reqPhonesByReq.set(row.requestId, list);
	}

	for (const row of allReqSpots) {
		const list = reqSpotsByReq.get(row.requestId) ?? [];
		list.push(row.spotNumber);
		reqSpotsByReq.set(row.requestId, list);
	}

	const requestsWithDetails = pendingRequests.map((r) => ({
		...r,
		emails: reqEmailsByReq.get(r.id) ?? [],
		phones: reqPhonesByReq.get(r.id) ?? [],
		requestedSpots: reqSpotsByReq.get(r.id) ?? []
	}));

	return { flats: flatsWithContacts, requests: requestsWithDetails, spots };
};
