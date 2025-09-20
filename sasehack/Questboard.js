import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Modal, ScrollView, TextInput, Alert, Platform } from "react-native";
import { collection, getDocs, addDoc, doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import googleConfig from './googleConfig';
import * as ImagePicker from "expo-image-picker";
import { FontAwesome } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';

export default function Questboard() {
  const [quests, setQuests] = useState([]);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostDesc, setNewPostDesc] = useState("");
  const [newPostImage, setNewPostImage] = useState(null);
  const [newQuestImage, setNewQuestImage] = useState(null);
  const [creatingQuest, setCreatingQuest] = useState(false);

  const CLASSES = [
    { name: "Explorer", icon: "map" },
    { name: "Baker", icon: "cutlery" },
    { name: "Artist", icon: "paint-brush" },
  ];

  const BADGES = [
    { name: "Bakery Novice", class: "Baker" },
    { name: "Bakery Expert", class: "Baker" },
    { name: "City Explorer", class: "Explorer" },
    { name: "Museum Visitor", class: "Explorer" },
    { name: "Sketcher", class: "Artist" },
  ];

  const [newQuest, setNewQuest] = useState({
    title: "",
    description: "",
    // location will store the human-readable place name
    location: "",
    // placeCoords stores { lat, lng }
    placeCoords: null,
    class: "",
    difficulty: 0,
    badge: "",
    startDate: null,
    endDate: null,
  });
  const [placeQuery, setPlaceQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [filteredBadges, setFilteredBadges] = useState([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateError, setDateError] = useState("");

  const fetchQuests = async () => {
    const questSnap = await getDocs(collection(db, "Quests"));
    const questList = questSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setQuests(questList);
  };

  useEffect(() => { fetchQuests(); }, []);

  const pickImage = async (setter) => {
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing:true, aspect:[1,1], quality:0.5 });
    if(!result.canceled) setter(result.assets[0].uri);
  };

  // Google Places Autocomplete: fetch predictions for query
  const fetchPredictions = async (query) => {
    if (!query) { setPredictions([]); return; }
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googleConfig.GOOGLE_API_KEY}&types=geocode`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.predictions) setPredictions(data.predictions);
    } catch (e) { console.warn('Places autocomplete error', e); }
  };

  // Fetch place details (lat/lng) for a place_id
  const fetchPlaceDetails = async (placeId) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${googleConfig.GOOGLE_API_KEY}&fields=geometry,name,formatted_address`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.result && data.result.geometry && data.result.geometry.location) {
        return {
          name: data.result.name || data.result.formatted_address || '',
          address: data.result.formatted_address || '',
          coords: { lat: data.result.geometry.location.lat, lng: data.result.geometry.location.lng }
        };
      }
    } catch (e) { console.warn('Place details error', e); }
    return null;
  };

  const handleCompleteQuest = async (quest) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      const userRef = doc(db, "Users", user.uid);
      const udoc = await getDoc(userRef);
      const userData = udoc.exists() ? udoc.data() : {};

      // Update XP: store xp as a single number field (sum existing + reward)
      const currentXp = Array.isArray(userData.xp) ? userData.xp.reduce((a,b)=>a+(Number(b)||0),0) : (Number(userData.xp) || 0);
      const rewardXp = quest?.rewards?.xp ? Number(quest.rewards.xp) : 0;
      const newXpTotal = currentXp + rewardXp;

      // Calculate level: every 100 XP is a new level (level 0 at 0-99 XP)
      const newLevel = Math.floor(newXpTotal / 100);

      // Prepare updates
      const updates = {};
      updates.xp = newXpTotal; // write as a number for simplicity
      updates.level = newLevel;

      // Update class counts: userData.class is expected to be an object/map of className -> count or an array
      if (quest.class) {
        // normalize classes stored as object map
        const currentClassMap = (userData.class && typeof userData.class === 'object' && !Array.isArray(userData.class)) ? { ...userData.class } : {};
        const cls = quest.class;
        currentClassMap[cls] = (Number(currentClassMap[cls]) || 0) + 1;
        updates.class = currentClassMap;
      }

      // Update badge progress/tier if quest has a badge
      if (quest.rewards && quest.rewards.badge) {
        const badgeTitle = quest.rewards.badge;
        // badges stored as map of objects under Users.badges where each key is title and value includes progress/tier OR as array of maps
        const badgesField = userData.badges || {};

        // If badges is an array, try to convert to map by title
        let badgeObj = null;
        if (Array.isArray(badgesField)) {
          // find by title
          const found = badgesField.find(b => b.title === badgeTitle);
          if (found) badgeObj = { ...found };
        } else if (badgesField && typeof badgesField === 'object') {
          // either badge stored under key or as nested object
          if (badgesField[badgeTitle]) badgeObj = { ...(badgesField[badgeTitle]) };
          else if (badgesField.title === badgeTitle) badgeObj = { ...badgesField };
        }

        // default badge structure
        if (!badgeObj) badgeObj = { title: badgeTitle, progress: 0, tier: 0 };

        badgeObj.progress = (Number(badgeObj.progress) || 0) + 1;
        // Determine tier thresholds: 5 -> tier1, 25 -> tier2, 50 -> tier3, 100 -> tier4
        const p = badgeObj.progress;
        let tier = 0;
        if (p >= 100) tier = 4;
        else if (p >= 50) tier = 3;
        else if (p >= 25) tier = 2;
        else if (p >= 5) tier = 1;
        badgeObj.tier = tier;

        // write back into updates.badges preserving existing structure where possible
        const newBadgesMap = (badgesField && typeof badgesField === 'object' && !Array.isArray(badgesField)) ? { ...badgesField } : {};
        newBadgesMap[badgeTitle] = badgeObj;
        updates.badges = newBadgesMap;
      }

  // Also append this quest id to user's completed quests array
  // Use arrayUnion to avoid duplicates
  await updateDoc(userRef, { ...updates, quests: arrayUnion(quest.id) });

      Alert.alert('Quest Completed!', `+${rewardXp} XP — Level ${newLevel}`);
      setModalVisible(false);
      fetchQuests();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  const handleAddPost = async (quest) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not signed in');

      let imageUrl = null;
      if (newPostImage) imageUrl = newPostImage;

      // try to get user's avatar and displayName from Users doc
      let userIcon = "";
      let username = user.displayName || "";
      try {
        const udoc = await getDoc(doc(db, "Users", user.uid));
        if (udoc.exists()) userIcon = udoc.data().avatarUrl || userIcon;
        if (udoc.exists()) username = udoc.data().displayName || username;
      } catch (e) { /* ignore */ }

      const questRef = doc(db, "Quests", quest.id);
      await updateDoc(questRef, { posts: arrayUnion({ username, userIcon, description: newPostDesc, image: imageUrl, userId: user.uid }) });

      // clear composer and refresh
      setNewPostDesc("");
      setNewPostImage(null);
      // refresh selectedQuest locally and refetch quests list
      const qdoc = await getDoc(questRef);
      if (qdoc.exists()) setSelectedQuest({ id: qdoc.id, ...qdoc.data() });
      fetchQuests();
    } catch (e) { Alert.alert('Error adding post', e.message); }
  };

  const handleCreateQuest = async () => {
    try {
      const user = auth.currentUser;
      // Validate date range
      if (newQuest.startDate && newQuest.endDate) {
        const s = new Date(newQuest.startDate);
        const e = new Date(newQuest.endDate);
        if (e < s) {
          Alert.alert("Invalid dates", "End date cannot be before start date.");
          return;
        }
      }

      // try to get user's avatar/url from Users doc (signup saves local uri into Users.avatarUrl)
      let userIcon = "";
      let displayName = "";
      try {
        const udoc = await getDoc(doc(db, "Users", user.uid));
        if (udoc.exists()) userIcon = udoc.data().avatarUrl || "";
        if (udoc.exists()) displayName = udoc.data().displayName || "";
      } catch(e){ /* ignore */ }

      // Prepare data to write; include place coordinates if available
      const questData = {
        ...newQuest,
        image: newQuestImage || null,
        rewards: { xp: newQuest.difficulty*10, badge: newQuest.badge },
        user: { name:displayName || "", icon:userIcon },
        posts: []
      };

      // If we have a placeQuery and no explicit location, set location
      if (placeQuery && !questData.location) questData.location = placeQuery;

      await addDoc(collection(db,"Quests"), questData);
      // reset create form
      setNewQuest({ title: "", description: "", location: "", class: "", difficulty: 0, badge: "", startDate: null, endDate: null });
      setNewQuestImage(null);
      setCreatingQuest(false);
      fetchQuests();
    } catch(e){ Alert.alert("Error", e.message); }
  };

  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString() : "";

  const handleStartDateChange = (event, selectedDate) => {
    setShowStartPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewQuest(prev => {
        const updated = { ...prev, startDate: selectedDate.toISOString() };
        if (prev.endDate && new Date(prev.endDate) < selectedDate) {
          updated.endDate = null;
          setDateError("End date was before start date and was cleared.");
        } else {
          setDateError("");
        }
        return updated;
      });
    }
  };

  const handleEndDateChange = (event, selectedDate) => {
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewQuest(prev => ({ ...prev, endDate: selectedDate.toISOString() }));
      setDateError("");
    }
  };

  const renderQuestCard = ({ item }) => {
    const start = item.startDate ? formatDate(item.startDate) : null;
    const end = item.endDate ? formatDate(item.endDate) : null;
    const dateRangeText = start && end ? `${start} — ${end}` : start ? `From ${start}` : end ? `Until ${end}` : null;
    const ended = item.endDate ? (new Date(item.endDate) < new Date()) : false;

    return (
      <TouchableOpacity style={styles.card} onPress={() => { setSelectedQuest(item); setModalVisible(true); }}>
        {item.image ? <Image source={{uri:item.image}} style={{width:"100%",height:140,borderRadius:8,marginBottom:8}} /> : null}

        <View style={{flexDirection:'row', alignItems:'center', marginBottom:4}}>
          {ended ? <Text style={styles.endedTag}>ENDED</Text> : null}
          <Text style={styles.title}>{item.title}</Text>
        </View>

        {dateRangeText ? <Text style={styles.dateRange}>{dateRangeText}</Text> : null}

  <Text style={{color:"#555"}}>{item.description.slice(0,50)}...</Text>
  <Text>Class: {item.class} | XP: {item.rewards.xp}</Text>
  {item.location ? <Text>Location: {item.location}{item.placeCoords ? ` (${item.placeCoords.lat.toFixed(4)}, ${item.placeCoords.lng.toFixed(4)})` : ''}</Text> : null}
        <View style={{flexDirection:'row', alignItems:'center'}}>
          {item.user?.icon ? <Image source={{uri:item.user.icon}} style={{width:28,height:28,borderRadius:14,marginRight:8}} /> : null}
          <Text>{item.user.name} {item.rewards.badge ? "| Badge: " + item.rewards.badge : ""}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{flex:1, padding:10, backgroundColor:"#f7f1e3"}}>
      <TouchableOpacity style={styles.createButton} onPress={()=>setCreatingQuest(true)}>
        <Text style={styles.buttonText}>Create New Quest</Text>
      </TouchableOpacity>

      <FlatList
        data={quests}
        keyExtractor={(item)=>item.id}
        renderItem={renderQuestCard}
      />

      {/* Quest Modal */}
      <Modal visible={modalVisible} animationType="slide">
        <ScrollView style={{padding:10}}>
          {selectedQuest && <>
            {selectedQuest.image ? <Image source={{uri:selectedQuest.image}} style={{width:'100%',height:220,borderRadius:8,marginBottom:12}} /> : null}
            <Text style={{fontSize:24,fontWeight:"bold"}}>{selectedQuest.title}</Text>
            <Text>{selectedQuest.description}</Text>
            <Text>Class: {selectedQuest.class}</Text>
            <Text>Difficulty: {selectedQuest.difficulty}</Text>
            <Text>Location: {selectedQuest.location}</Text>
            {selectedQuest.placeCoords ? <Text>Coords: {selectedQuest.placeCoords.lat}, {selectedQuest.placeCoords.lng}</Text> : null}
            <View style={{flexDirection:'row', alignItems:'center'}}>
              {selectedQuest.user?.icon ? <Image source={{uri:selectedQuest.user.icon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
              <Text>{selectedQuest.user.name}</Text>
            </View>
            <Text>XP: {selectedQuest.rewards.xp} | Badge: {selectedQuest.rewards.badge || "None"}</Text>

            <Text style={{marginTop:20,fontSize:18,fontWeight:"bold"}}>Posts</Text>
            <View style={styles.postsSection}>
              {selectedQuest.posts?.length ? selectedQuest.posts.map((p,i)=>(
                <View key={i} style={styles.postCard}>
                  <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
                    {p.userIcon ? <Image source={{uri:p.userIcon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                    <Text style={{fontWeight:'600'}}>{p.username}</Text>
                  </View>
                  <Text style={{color:'#333', marginBottom:6}}>{p.description}</Text>
                  {p.image && <Image source={{uri:p.image}} style={styles.postImagePreview} />}
                </View>
              )) : <Text style={{color:'#666'}}>No posts yet. Be the first to share!</Text>}
            </View>

            {/* Composer Box */}
            <View style={styles.composerBox}>
              <TextInput placeholder="Write a post... (max 50 words)" style={[styles.input,{flex:1, marginBottom:0, backgroundColor:'#fff'}]} value={newPostDesc} onChangeText={setNewPostDesc} multiline />
              <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}>
                <TouchableOpacity style={styles.buttonSmall} onPress={()=>pickImage(setNewPostImage)}>
                  <Text style={styles.buttonText}>Add Image</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:'#00b894'}]} onPress={()=>handleAddPost(selectedQuest)}>
                  <Text style={styles.buttonText}>Post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:'#d63031'}]} onPress={()=>{ setNewPostDesc(''); setNewPostImage(null); }}>
                  <Text style={styles.buttonText}>Clear</Text>
                </TouchableOpacity>
              </View>
              {newPostImage ? <Image source={{uri:newPostImage}} style={styles.postImagePreview} /> : null}
            </View>

            <View style={{marginTop:8}}>
              <TouchableOpacity style={[styles.button,{backgroundColor:"#00b894"}]} onPress={()=>handleCompleteQuest(selectedQuest)}>
                <Text style={styles.buttonText}>Complete Quest</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.button,{backgroundColor:"#d63031"}]} onPress={()=>setModalVisible(false)}>
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </>}
        </ScrollView>
      </Modal>

      {/* Create Quest Modal */}
      <Modal visible={creatingQuest} animationType="slide">
        <ScrollView style={{padding:10}}>
          <TextInput
            placeholder="Title"
            style={styles.input}
            value={newQuest.title}
            onChangeText={(text)=>setNewQuest({...newQuest,title:text})}
          />
          <TextInput
            placeholder="Description"
            style={[styles.input,{height:100}]}
            value={newQuest.description}
            onChangeText={(text)=>setNewQuest({...newQuest,description:text})}
            multiline
          />
          <TextInput
            placeholder="Location (Optional)"
            style={styles.input}
            value={placeQuery || newQuest.location}
            onChangeText={(text)=>{
              setPlaceQuery(text);
              setNewQuest({...newQuest, location: ''});
              fetchPredictions(text);
            }}
          />

          {predictions.length > 0 && (
            <View style={{backgroundColor:'#fff', borderRadius:8, marginBottom:6}}>
              {predictions.map(p => (
                <TouchableOpacity key={p.place_id} style={{padding:8,borderBottomWidth:1,borderColor:'#eee'}} onPress={async ()=>{
                  const details = await fetchPlaceDetails(p.place_id);
                  if (details) {
                    setNewQuest(prev=> ({...prev, location: details.name || details.address, placeCoords: details.coords }));
                    setPlaceQuery(details.name || details.address);
                    setPredictions([]);
                  }
                }}>
                  <Text>{p.description}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={()=>pickImage(setNewQuestImage)}>
            <Text style={styles.buttonText}>Pick Quest Image (Optional)</Text>
          </TouchableOpacity>
          {newQuestImage ? <Image source={{uri:newQuestImage}} style={{width:120,height:120,alignSelf:'center',borderRadius:8,marginVertical:6}} /> : null}

          {/* Date Range */}
          <Text style={{marginTop:10, fontWeight:"bold"}}>Quest Date Range (optional)</Text>
          <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between"}}>
            <TouchableOpacity style={[styles.button,{flex:1, marginRight:5, backgroundColor:'#74b9ff'}]} onPress={()=>setShowStartPicker(true)}>
              <Text style={styles.buttonText}>{newQuest.startDate ? `Start: ${formatDate(newQuest.startDate)}` : 'Set Start Date'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button,{flex:1, marginLeft:5, backgroundColor:'#55efc4'}]} onPress={()=>setShowEndPicker(true)}>
              <Text style={styles.buttonText}>{newQuest.endDate ? `End: ${formatDate(newQuest.endDate)}` : 'Set End Date'}</Text>
            </TouchableOpacity>
          </View>
          {dateError ? <Text style={{color:'red',marginTop:6}}>{dateError}</Text> : null}

          {showStartPicker && (
            <DateTimePicker
              value={newQuest.startDate ? new Date(newQuest.startDate) : new Date()}
              mode="date"
              display="default"
              onChange={handleStartDateChange}
              maximumDate={newQuest.endDate ? new Date(newQuest.endDate) : undefined}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={newQuest.endDate ? new Date(newQuest.endDate) : (newQuest.startDate ? new Date(newQuest.startDate) : new Date())}
              mode="date"
              display="default"
              onChange={handleEndDateChange}
              minimumDate={newQuest.startDate ? new Date(newQuest.startDate) : undefined}
            />
          )}

          {/* Class Picker */}
          <Text style={{marginTop:10, fontWeight:"bold"}}>Select Class:</Text>
          <View style={{flexDirection:"row", marginVertical:5}}>
            {CLASSES.map((c) => (
              <TouchableOpacity
                key={c.name}
                style={{
                  padding:10,
                  marginRight:10,
                  borderWidth: newQuest.class === c.name ? 2 : 1,
                  borderColor: newQuest.class === c.name ? "#6c5ce7" : "#ccc",
                  borderRadius:8,
                  alignItems:"center"
                }}
                onPress={() => {
                  setNewQuest({...newQuest,class:c.name});
                  setFilteredBadges(BADGES.filter(b => b.class === c.name));
                  setNewQuest(prev => ({...prev, badge:""}));
                }}
              >
                <FontAwesome name={c.icon} size={24} color="#333" />
                <Text>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Difficulty Stars */}
          <Text style={{fontWeight:"bold"}}>Select Difficulty:</Text>
          <View style={{flexDirection:"row", marginVertical:5}}>
            {[1,2,3].map((star)=>(
              <TouchableOpacity key={star} onPress={()=>setNewQuest({...newQuest,difficulty:star})}>
                <FontAwesome
                  name={star <= newQuest.difficulty ? "star" : "star-o"}
                  size={32}
                  color="#f1c40f"
                  style={{marginRight:5}}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text>XP Reward: {newQuest.difficulty*10}</Text>

          {/* Badge Picker */}
          {filteredBadges.length > 0 && (
            <>
              <Text style={{fontWeight:"bold", marginTop:10}}>Select Badge Reward:</Text>
              <View style={{flexDirection:"row", flexWrap:"wrap"}}>
                {filteredBadges.map(b => (
                  <TouchableOpacity
                    key={b.name}
                    style={{
                      padding:8,
                      borderWidth: newQuest.badge === b.name ? 2 : 1,
                      borderColor: newQuest.badge === b.name ? "#6c5ce7" : "#ccc",
                      borderRadius:8,
                      margin:5
                    }}
                    onPress={()=>setNewQuest({...newQuest,badge:b.name})}
                  >
                    <Text>{b.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <TouchableOpacity style={[styles.button,{backgroundColor:"#6c5ce7"}]} onPress={handleCreateQuest}>
            <Text style={styles.buttonText}>Create Quest</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button,{backgroundColor:"#d63031"}]} onPress={()=>setCreatingQuest(false)}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor:"#fff", padding:15, borderRadius:10, marginBottom:10 },
  title: { fontSize:18, fontWeight:"bold" },
  endedTag: { backgroundColor:'#d63031', color:'#fff', paddingHorizontal:6, paddingVertical:2, borderRadius:4, marginRight:8, fontWeight:'bold' },
  dateRange: { color:'#333', marginBottom:6, fontStyle:'italic' },
  button: { padding:10, borderRadius:8, backgroundColor:"#6c5ce7", marginVertical:5 },
  buttonText: { color:"#fff", textAlign:"center", fontWeight:"bold" },
  createButton: { padding:15, borderRadius:10, backgroundColor:"#00b894", marginBottom:10 },
  input: { backgroundColor:"#fff", padding:10, borderRadius:8, marginVertical:5 }
});

// Additional styles added for posts and composer
Object.assign(styles, StyleSheet.create({
  postCard: { backgroundColor:'#fff', padding:10, borderRadius:8, marginVertical:6 },
  composerBox: { backgroundColor:'#f0f0f0', padding:10, borderRadius:8, marginVertical:10 },
  postsSection: { marginTop:8 },
  buttonSmall: { padding:8, borderRadius:8, backgroundColor:'#6c5ce7', minWidth:90, marginRight:6 },
  postImagePreview: { width:'100%', height:150, borderRadius:8, marginTop:8 }
}));
