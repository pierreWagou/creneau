<script lang="ts">
	import * as Card from '$lib/components/ui/card';
	import * as Tabs from '$lib/components/ui/tabs';

	let { data } = $props();

	let rankingPeriod = $state<'month' | 'all'>('month');

	let currentRanking = $derived(rankingPeriod === 'month' ? data.building.ranking.thisMonth : data.building.ranking.allTime);
	let maxHours = $derived(currentRanking.length > 0 ? currentRanking[0].hours : 1);
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<h2 class="page-title">Activité</h2>

	<!-- Mon activité -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Mon activité</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<div class="text-center">
					<p class="stat-value">{data.personal.totalHours}h</p>
					<p class="stat-label">Total heures</p>
				</div>
				<div class="text-center">
					<p class="stat-value">{data.personal.monthHours}h</p>
					<p class="stat-label">Ce mois</p>
				</div>
				<div class="text-center">
					<p class="stat-value">{data.personal.upcomingBookings}</p>
					<p class="stat-label">À venir</p>
				</div>
				<div class="text-center">
					<p class="stat-value">{data.personal.totalBookings}</p>
					<p class="stat-label">Réservations</p>
				</div>
			</div>
			<p class="stat-hint">Les heures incluent les réservations passées et à venir.</p>
		</Card.Content>
	</Card.Root>

	<!-- Immeuble -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Immeuble</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-6">
			<!-- Utilisation -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium">Utilisation ce mois</span>
					<span class="text-sm font-medium">{data.building.utilization}%</span>
				</div>
				<div class="bg-muted h-3 w-full rounded-full">
					<div class="bg-primary h-3 rounded-full transition-all" style="width: {data.building.utilization}%"></div>
				</div>
			</div>

			<!-- Classement -->
			<div class="space-y-3">
				<div class="flex items-center justify-between">
					<span class="text-sm font-medium">Classement des résidents</span>
					<Tabs.Root bind:value={rankingPeriod}>
						<Tabs.List>
							<Tabs.Trigger value="month">Ce mois</Tabs.Trigger>
							<Tabs.Trigger value="all">Tout</Tabs.Trigger>
						</Tabs.List>
					</Tabs.Root>
				</div>

				{#if currentRanking.length === 0}
					<p class="text-muted-foreground text-center text-sm">Aucune réservation pour cette période.</p>
				{:else}
					<div class="space-y-3">
						{#each currentRanking as entry, i}
							<div class="flex items-center gap-3">
								<span class="text-muted-foreground w-5 text-right text-sm font-medium">{i + 1}.</span>
								<div class="min-w-0 flex-1">
									<div class="mb-1 flex items-center justify-between">
										<span class="truncate text-sm font-medium">
											{entry.flatNumber}{entry.displayName ? ` — ${entry.displayName}` : ''}
										</span>
										<span class="text-muted-foreground shrink-0 text-xs">{entry.hours}h</span>
									</div>
									<div class="ranking-bar-track">
										<div
											class="ranking-bar-fill"
											style="width: {(entry.hours / maxHours) * 100}%"
										></div>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>
</div>
