import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from './ui';
import { colors, fonts, radius, spacing } from '../theme';
import { CreateApiEndpointRequest, UpdateApiEndpointRequest, ApiEndpoint } from '../types';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateApiEndpointRequest | UpdateApiEndpointRequest) => Promise<void>;
  endpoint?: ApiEndpoint | null;
  loading?: boolean;
}

export function EndpointForm({ visible, onClose, onSubmit, endpoint, loading }: Props) {
  const isEdit = !!endpoint;

  const [name, setName] = useState(endpoint?.name || '');
  const [method, setMethod] = useState<string>(endpoint?.method || 'GET');
  const [path, setPath] = useState(endpoint?.path || '');
  const [expectedStatus, setExpectedStatus] = useState(
    endpoint?.expected_status?.toString() || '200'
  );
  const [description, setDescription] = useState(endpoint?.description || '');
  const [requestBody, setRequestBody] = useState(endpoint?.request_body || '');
  const [headersText, setHeadersText] = useState(
    endpoint?.headers ? formatHeaders(endpoint.headers) : ''
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!path.trim()) {
      setError('Path is required');
      return;
    }

    const headers = parseHeaders(headersText);
    const status = parseInt(expectedStatus, 10);

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        method,
        path: path.trim(),
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        request_body: requestBody.trim() || undefined,
        expected_status: isNaN(status) ? 200 : status,
        description: description.trim() || undefined,
      });
      if (!isEdit) {
        setName('');
        setMethod('GET');
        setPath('');
        setExpectedStatus('200');
        setDescription('');
        setRequestBody('');
        setHeadersText('');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to save endpoint');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>{isEdit ? 'Edit Endpoint' : 'Add Endpoint'}</Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Method selector */}
            <Text style={styles.label}>Method</Text>
            <View style={styles.methodRow}>
              {METHODS.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMethod(m)}
                  style={[
                    styles.methodChip,
                    method === m && { borderColor: METHOD_COLORS[m], backgroundColor: METHOD_COLORS[m] + '22' },
                  ]}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      method === m && { color: METHOD_COLORS[m] },
                    ]}
                  >
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Input
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Get Users, Create Order"
            />
            <Input
              label="Path"
              value={path}
              onChangeText={setPath}
              placeholder="/api/v1/users"
              autoCapitalize="none"
              style={styles.monoInput}
            />
            <Input
              label="Expected Status"
              value={expectedStatus}
              onChangeText={setExpectedStatus}
              placeholder="200"
              keyboardType="numeric"
            />
            <Input
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description"
              multiline
            />
            <Input
              label="Headers (one per line: Key: Value)"
              value={headersText}
              onChangeText={setHeadersText}
              placeholder={"Content-Type: application/json\nAuthorization: Bearer token"}
              multiline
              numberOfLines={3}
              style={styles.monoInput}
            />
            {(method === 'POST' || method === 'PUT' || method === 'PATCH') && (
              <Input
                label="Request Body (JSON)"
                value={requestBody}
                onChangeText={setRequestBody}
                placeholder={'{\n  "key": "value"\n}'}
                multiline
                numberOfLines={4}
                style={styles.monoInput}
              />
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Button title="Cancel" variant="secondary" onPress={onClose} />
            <Button
              title={isEdit ? 'Save' : 'Add'}
              onPress={handleSubmit}
              loading={submitting || loading}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function parseHeaders(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key) result[key] = val;
    }
  }
  return result;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: colors.bgSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: fonts.sizes.xl,
    fontWeight: '700',
  },
  label: {
    color: colors.textSecondary,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  methodRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  methodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodChipText: {
    color: colors.textTertiary,
    fontSize: fonts.sizes.xs,
    fontWeight: '700',
    fontFamily: fonts.mono,
  },
  monoInput: {
    fontFamily: fonts.mono,
    fontSize: fonts.sizes.sm,
  },
  error: {
    color: colors.danger,
    fontSize: fonts.sizes.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
