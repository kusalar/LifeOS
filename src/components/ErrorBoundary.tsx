import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C, R, S, alpha } from '../theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unexpected error' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (__DEV__) {
      console.warn('LifeOS ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: C.bg,
            alignItems: 'center',
            justifyContent: 'center',
            padding: S.xl,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 20,
              backgroundColor: alpha(C.amber, 0.12),
              borderWidth: 1,
              borderColor: alpha(C.amber, 0.35),
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shield-outline" size={28} color={C.amber} />
          </View>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>
            Something went wrong loading this screen.
          </Text>
          <Text style={{ color: C.sub, fontSize: 13, textAlign: 'center', lineHeight: 20, maxWidth: 320 }}>
            Your local data has not been deleted and remains safe in offline storage.
          </Text>
          <Pressable
            onPress={this.handleRetry}
            style={({ pressed }) => ({
              backgroundColor: C.amber,
              borderRadius: R.pill,
              paddingHorizontal: 24,
              paddingVertical: 12,
              marginTop: 8,
              opacity: pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="Retry loading screen"
          >
            <Text style={{ color: '#1A1206', fontWeight: '800', fontSize: 14 }}>Try Again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
