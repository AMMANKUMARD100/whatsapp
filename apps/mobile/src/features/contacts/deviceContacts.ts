import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';
import { DeviceContact } from './types';

export async function getDeviceContacts(): Promise<DeviceContact[]> {
  if (Platform.OS === 'web') return [];

  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return [];

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
  });

  const results: DeviceContact[] = [];
  data.forEach((c) => {
    if (c.phoneNumbers && c.phoneNumbers.length > 0 && c.name) {
      c.phoneNumbers.forEach((p) => {
        if (p.number) {
          results.push({
            id: `${c.id}-${p.number}`,
            name: c.name,
            phoneNumber: p.number,
          });
        }
      });
    }
  });

  return results;
}
