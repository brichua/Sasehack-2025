import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function Landing({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Welcome to Questboard RPG</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Login")}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, { backgroundColor: "#00b894" }]} onPress={() => navigation.navigate("Signup")}>
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:"center", alignItems:"center", backgroundColor:"#f7f1e3", padding:20 },
  header: { fontSize:28, fontWeight:"bold", marginBottom:40, textAlign:"center" },
  button: { backgroundColor: "#6c5ce7", padding:15, borderRadius:10, width:"80%", marginBottom:15 },
  buttonText: { color:"#fff", textAlign:"center", fontWeight:"bold" },
});
