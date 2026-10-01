import { redirect } from '@sveltejs/kit';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { FLATS_PAGE_SIZE } from '$lib/constants';
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
import { reapExpiredInvitations } from '$lib/server/flat-state';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.flat?.isAdmin) {
		throw redirect(302, '/calendar');
	}

	const q = url.searchParams.get('q')?.trim() ?? '';
	const pageParam = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
	const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

	// Lazy expiry: dead invitations return their flats to inactive before any read,
	// so no reader below can ever observe an expired code.
	await reapExpiredInvitations();

	const VALID_STATUSES = ['active', 'inactive', 'pending'] as const;
	const status = [
		...new Set(
			url.searchParams
				.getAll('status')
				.filter((s): s is (typeof VALID_STATUSES)[number] => (VALID_STATUSES as readonly string[]).includes(s))
		)
	];

	// Substring search on number + display name (LIKE is ASCII case-insensitive,
	// matching the previous client-side toLowerCase().includes() semantics)
	const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
	const pattern = `%${escaped}%`;
	const qWhere = q
		? sql`(${flat.number} LIKE ${pattern} ESCAPE '\\' OR ${flat.displayName} LIKE ${pattern} ESCAPE '\\')`
		: undefined;

	// Stored machine facet (mirror client getFlatState). Expired codes never reach
	// these readers — reapExpiredInvitations() above already returned those flats to inactive.
	const statusWhere = status.length > 0 ? inArray(flat.status, status) : undefined;

	const conditions = [qWhere, statusWhere].filter((c) => c !== undefined);
	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const [{ total }] = await db.select({ total: count() }).from(flat).where(where).all();
	const [{ total: grandTotal }] = await db.select({ total: count() }).from(flat).all();

	// Load one page of flats
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
		.where(where)
		.orderBy(flat.number)
		.limit(FLATS_PAGE_SIZE)
		.offset((page - 1) * FLATS_PAGE_SIZE)
		.all();

	// Lightweight full list for cross-page lookups (swap targets, spot owners)
	const allFlatBrief = await db
		.select({ number: flat.number, displayName: flat.displayName })
		.from(flat)
		.orderBy(flat.number)
		.all();
	const ownerNames: Record<string, string | null> = Object.fromEntries(
		allFlatBrief.map((f) => [f.number, f.displayName])
	);

	// Load pending requests
	const pendingRequests = await db.select().from(request).where(eq(request.status, 'pending')).all();

	// Load spots
	const spots = await db.select().from(spot).all();

	// Load contacts for the page flats only
	const pageNumbers = flats.map((f) => f.number);
	const allFlatEmails =
		pageNumbers.length > 0
			? await db.select().from(flatEmail).where(inArray(flatEmail.flatNumber, pageNumbers)).all()
			: [];
	const allFlatPhones =
		pageNumbers.length > 0
			? await db.select().from(flatPhone).where(inArray(flatPhone.flatNumber, pageNumbers)).all()
			: [];

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

	return {
		flats: flatsWithContacts,
		total,
		grandTotal,
		page,
		pageSize: FLATS_PAGE_SIZE,
		q,
		status,
		requests: requestsWithDetails,
		spots,
		ownerNames,
		flatOptions: allFlatBrief,
		viewerFlatNumber: locals.flat.number
	};
};
