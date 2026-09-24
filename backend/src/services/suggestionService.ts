import { Prisma, SuggestionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../utils/errors.js';
import { SuggestionInput, SuggestionUpdateInput } from '../validators/feedbackSchemas.js';
import { chefDisplayName, visibleChefWhere } from './catalogShared.js';
import { requireOwnKitchen } from './kitchenService.js';

// Customers suggest dishes they would like a chef to cook; neighbors vote for the ones they want too.
// Each person counts once per suggestion, and the suggester's own vote is counted from the start.

const OPEN_STATUSES: SuggestionStatus[] = ['PENDING', 'CONSIDERING'];
const MAX_OPEN_PER_PERSON = 5;

function suggestionSelect(viewerId?: string) {
  return {
    id: true,
    mealName: true,
    description: true,
    dietaryRequirements: true,
    status: true,
    votes: true,
    chefResponse: true,
    createdAt: true,
    customer: { select: { firstName: true, lastName: true } },
    // Only the viewer's own vote, to tell whether they have voted. Logged-out visitors match nothing.
    voters: { where: { userId: viewerId ?? '' }, select: { id: true } },
  } satisfies Prisma.SuggestionSelect;
}

type SuggestionRow = Prisma.SuggestionGetPayload<{ select: ReturnType<typeof suggestionSelect> }>;

function toSuggestion(suggestion: SuggestionRow) {
  const { customer, voters, ...rest } = suggestion;
  return { ...rest, suggestedBy: chefDisplayName(customer), hasVoted: voters.length > 0 };
}

function notFound() {
  return new AppError(404, 'NOT_FOUND', 'We could not find that dish request');
}

async function findVisibleChef(chefId: string) {
  const chef = await prisma.chefProfile.findFirst({ where: { id: chefId, ...visibleChefWhere }, select: { id: true, userId: true } });
  if (!chef) throw new AppError(404, 'NOT_FOUND', 'We could not find that chef');
  return chef;
}

export async function createSuggestion(userId: string, chefId: string, input: SuggestionInput) {
  const chef = await findVisibleChef(chefId);
  if (chef.userId === userId) throw new AppError(409, 'OWN_KITCHEN', 'You cannot request dishes from your own kitchen');

  const openCount = await prisma.suggestion.count({
    where: { chefId: chef.id, customerId: userId, status: { in: OPEN_STATUSES } },
  });
  if (openCount >= MAX_OPEN_PER_PERSON) {
    throw new AppError(
      409,
      'TOO_MANY_SUGGESTIONS',
      `You already have ${MAX_OPEN_PER_PERSON} open requests for this chef. Wait for the chef to answer some of them first.`,
    );
  }

  const suggestion = await prisma.suggestion.create({
    data: {
      chefId: chef.id,
      customerId: userId,
      mealName: input.mealName,
      description: input.description,
      dietaryRequirements: input.dietaryRequirements,
      votes: 1,
      voters: { create: { userId } },
    },
    select: suggestionSelect(userId),
  });
  return toSuggestion(suggestion);
}

/** Open and answered requests shown on the chef's page, most wanted first. Declined ones are hidden. */
export async function listChefSuggestions(chefId: string, viewerId?: string) {
  const chef = await findVisibleChef(chefId);
  const suggestions = await prisma.suggestion.findMany({
    where: { chefId: chef.id, status: { not: 'DECLINED' } },
    select: suggestionSelect(viewerId),
    orderBy: [{ votes: 'desc' }, { createdAt: 'asc' }],
  });
  return suggestions.map(toSuggestion);
}

/** Adds the person's vote. Voting twice changes nothing. */
export async function vote(userId: string, suggestionId: string) {
  return prisma.$transaction(async (tx) => {
    const suggestion = await tx.suggestion.findFirst({
      where: { id: suggestionId, status: { not: 'DECLINED' }, chef: visibleChefWhere },
      select: { id: true, chef: { select: { userId: true } } },
    });
    if (!suggestion) throw notFound();
    if (suggestion.chef.userId === userId) {
      throw new AppError(409, 'OWN_KITCHEN', 'Votes are for neighbors. You can answer this request from your dashboard.');
    }

    const { count } = await tx.suggestionVote.createMany({ data: [{ suggestionId, userId }], skipDuplicates: true });
    if (count > 0) await tx.suggestion.update({ where: { id: suggestionId }, data: { votes: { increment: 1 } } });
    return toSuggestion(await tx.suggestion.findUniqueOrThrow({ where: { id: suggestionId }, select: suggestionSelect(userId) }));
  });
}

/** Takes the person's vote back. Doing it twice changes nothing. */
export async function removeVote(userId: string, suggestionId: string) {
  return prisma.$transaction(async (tx) => {
    const suggestion = await tx.suggestion.findUnique({ where: { id: suggestionId }, select: { id: true } });
    if (!suggestion) throw notFound();

    const { count } = await tx.suggestionVote.deleteMany({ where: { suggestionId, userId } });
    if (count > 0) await tx.suggestion.update({ where: { id: suggestionId }, data: { votes: { decrement: 1 } } });
    return toSuggestion(await tx.suggestion.findUniqueOrThrow({ where: { id: suggestionId }, select: suggestionSelect(userId) }));
  });
}

/** Every request for the signed-in chef's kitchen, including declined ones. Open requests come first. */
export async function listOwnKitchenSuggestions(userId: string) {
  const chef = await requireOwnKitchen(userId);
  const suggestions = await prisma.suggestion.findMany({
    where: { chefId: chef.id },
    select: suggestionSelect(userId),
    orderBy: [{ votes: 'desc' }, { createdAt: 'asc' }],
  });
  const rank = (status: SuggestionStatus) => (OPEN_STATUSES.includes(status) ? 0 : 1);
  return suggestions.map(toSuggestion).sort((a, b) => rank(a.status) - rank(b.status));
}

export async function updateSuggestion(userId: string, suggestionId: string, input: SuggestionUpdateInput) {
  const chef = await requireOwnKitchen(userId);
  const { count } = await prisma.suggestion.updateMany({
    where: { id: suggestionId, chefId: chef.id },
    data: { status: input.status, chefResponse: input.chefResponse },
  });
  if (count === 0) throw notFound();
  return toSuggestion(await prisma.suggestion.findUniqueOrThrow({ where: { id: suggestionId }, select: suggestionSelect(userId) }));
}
