import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TimerPermissionsList } from '@/features/timer/permissions-list';
import { markWelcomeSeen } from '@/lib/welcome';

/** First-launch screen: explains and asks for the permissions the timer alerts need. */
export default function WelcomeScreen() {
  const finish = () => {
    markWelcomeSeen();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={require('@/assets/images/icon.png')} style={styles.mascot} contentFit="contain" />
        <View style={styles.intro}>
          <Text variant="headlineMedium" style={styles.center}>
            Bem-vindo ao RepTile
          </Text>
          <Text variant="bodyLarge" style={[styles.center, styles.muted]}>
            Para avisar o fim do descanso e os intervalos do WOD mesmo com a tela apagada, o app precisa de algumas
            permissões.
          </Text>
        </View>
        <Card mode="contained">
          <TimerPermissionsList />
        </Card>
        <Text variant="bodySmall" style={[styles.center, styles.muted]}>
          Sem elas o timer continua funcionando, mas só avisa com o app aberto. Você pode mudar isso depois em Ajustes.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button mode="contained" onPress={finish} contentStyle={styles.button}>
          Começar
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 24, gap: 20 },
  mascot: { width: 120, height: 120, alignSelf: 'center', borderRadius: 28 },
  intro: { gap: 8 },
  center: { textAlign: 'center' },
  muted: { opacity: 0.75 },
  footer: { padding: 16 },
  button: { height: 52 },
});
