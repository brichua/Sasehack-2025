import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function Questboard({ route }) {
  const { userId } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>🏰 Questboard</Text>
      <Text style={styles.subheader}>Welcome, user {userId}!</Text>
      {/* Here you can integrate your Questboard list, XP, badges etc. */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f7f1e3" },
  header: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
  subheader: { fontSize: 16 },
});
