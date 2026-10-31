import { apiFetch } from '../../core/api/client';
import { MatchedUser } from './types';

export const contactsApi = {
  matchContacts: (hashes: string[]) =>
    apiFetch<{ users: MatchedUser[] }>('/contacts/match', {
      method: 'POST',
      body: { hashes },
    }),

  lookupByPhone: (phone: string) =>
    apiFetch<{ user: MatchedUser }>(`/contacts/lookup?phone=${encodeURIComponent(phone)}`),

  discover: () =>
    apiFetch<{ users: MatchedUser[] }>('/contacts/discover'),
};
