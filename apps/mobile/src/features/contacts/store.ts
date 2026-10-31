import { create } from 'zustand';
import { Platform } from 'react-native';
import { contactsApi } from './contactsApi';
import { getDeviceContacts } from './deviceContacts';
import { hashPhoneNumber } from './hash';
import { DeviceContact, MatchedUser } from './types';

interface ContactsStore {
  registeredUsers: MatchedUser[];
  deviceContacts: DeviceContact[];
  loading: boolean;
  sync: () => Promise<void>;
}

export const useContactsStore = create<ContactsStore>((set) => ({
  registeredUsers: [],
  deviceContacts: [],
  loading: false,

  sync: async () => {
    set({ loading: true });
    try {
      if (Platform.OS === 'web') {
        // On web, discover all registered users automatically
        const res = await contactsApi.discover();
        set({
          registeredUsers: res.users,
          deviceContacts: [],
          loading: false,
        });
        return;
      }

      // On native iOS/Android, sync with device address book
      const contacts = await getDeviceContacts();
      const hashes = await Promise.all(
        contacts.map((c) => hashPhoneNumber(c.phoneNumber.replace(/[\s\-()]/g, ''))),
      );

      const uniqueHashes = [...new Set(hashes)];
      const { users } = await contactsApi.matchContacts(uniqueHashes);

      set({
        deviceContacts: contacts,
        registeredUsers: users,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },
}));
