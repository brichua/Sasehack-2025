import React, { useEffect, useState } from "react";
import {
    SafeAreaView,
    StatusBar,
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Image,
    Modal,
    ScrollView,
    TextInput,
    Alert,
    Platform
} from "react-native";
import * as Location from 'expo-location';
import { collection, getDocs, addDoc, doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { db, auth } from "./firebase";
import googleConfig from './googleConfig';
import * as ImagePicker from "expo-image-picker";
import { FontAwesome, FontAwesome6 } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';

export default function Questboard() {
  // color palette requested
  const COLORS = {
    viridian: '#6b9080ff',
    cambridgeBlue: '#a4c3b2ff',
    mintGreen: '#cce3deff',
    azureWeb: '#eaf4f4ff',
    mintCream: '#f6fff8ff',
    textDark: '#163626',
    textMuted: '#556b63'
  };

  const CLASS_ICONS = {
  Explorer: 'map',
  Baker: 'utensils',
  Artist: 'paintbrush',
  Performer: 'masks-theater',
  Musician: 'music',
  Foodie: 'utensils',
  Historian: 'landmark',
  Connector: 'champagne-glasses'
  };

  // common alias map for icon names across FA versions (fallbacks)
  const ICON_ALIASES = {
    'paintbrush': 'paintbrush',
    'brush': 'paintbrush',
    'person-hiking': 'person-hiking',
    'kitchen-set': 'utensils',
    'cake-candles': 'cake-candles',
    'mug-hot': 'mug-hot',
    'building-columns': 'building-columns',
    'gifts': 'gift'
  };

  const normalizeIcon = (name) => {
    if (!name) return name;
    return ICON_ALIASES[name] || name;
  };

  const [quests, setQuests] = useState([]);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [selectedQuestPosts, setSelectedQuestPosts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPostDesc, setNewPostDesc] = useState("");
  const [newPostImage, setNewPostImage] = useState(null);
  const [newQuestImage, setNewQuestImage] = useState(null);
  const [creatingQuest, setCreatingQuest] = useState(false);

  const CLASSES = [
    { name: "Explorer", icon: "map" },
    { name: "Artist", icon: "paintbrush" },
    { name: "Performer", icon: "masks-theater" },
    { name: "Musician", icon: "music" },
    { name: "Foodie", icon: "utensils" },
    { name: "Historian", icon: "landmark" },
    { name: "Connector", icon: "champagne-glasses" }
  ];

  const BADGES = [
    { name: "Trailblazer", class: "Explorer", icon: 'person-hiking' },
    { name: "Urban Explorer", class: "Explorer", icon: 'city' },

    { name: "Sketcher", class: "Artist", icon: 'brush' },
    { name: "Hands-on Artist", class: "Artist", icon: 'cube' },
    { name: "Creative Spark", class: "Artist", icon: 'palette' },

    { name: "Film Buff", class: "Performer", icon: 'film' },
    { name: "Broadway Bound", class: "Performer", icon: 'masks-theater' },
    { name: "Theater Aficionado", class: "Performer", icon: 'ticket' },

    { name: "Future Virtuoso", class: "Musician", icon: 'guitar' },
    { name: "Concert Connoisseur", class: "Musician", icon: 'music' },

    { name: "Chef", class: "Foodie", icon: 'kitchen-set' },
    { name: "Baker", class: "Foodie", icon: 'cake-candles' },
    { name: "Taste Tester", class: "Foodie", icon: 'pizza-slice' },
    { name: "Something Sweet", class: "Foodie", icon: 'mug-hot' },

    { name: "Time Traveler", class: "Historian", icon: 'archway' },
    { name: "Walking through Time", class: "Historian", icon: 'building-columns' },

    { name: "Social Butterfly", class: "Connector", icon: 'gifts' },
    { name: "Community Enthusiast", class: "Connector", icon: 'calendar' }
  ];

  // quick lookup map for badge icons by badge name
  const BADGE_ICONS = BADGES.reduce((m, b) => { m[b.name] = b.icon || null; return m; }, {});

  const [newQuest, setNewQuest] = useState({
    title: "",
    description: "",
    location: "",
    placeCoords: null,
    class: "",
    difficulty: 0,
    badge: "",
    startDate: null,
    endDate: null,
  });

  // Filter states
  const [classFilterModal, setClassFilterModal] = useState(false);
  const [locationFilterModal, setLocationFilterModal] = useState(false);
  const [timeFilterModal, setTimeFilterModal] = useState(false);

  const [selectedClasses, setSelectedClasses] = useState([]); // array of class names
  const [locationFilter, setLocationFilter] = useState({ coords: null, radiusKm: 5 });
  const [timeFilterDate, setTimeFilterDate] = useState(null); // ISO string
  const [guildFilterModal, setGuildFilterModal] = useState(false);
  const [guildQuery, setGuildQuery] = useState('');
  const [guildsList, setGuildsList] = useState([]); // cached list of all guilds
  const [guildResults, setGuildResults] = useState([]); // filtered results for query
  const [selectedGuildFilter, setSelectedGuildFilter] = useState(null); // {id,name,icon}
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [predictions, setPredictions] = useState([]);
  const [filteredBadges, setFilteredBadges] = useState([]);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [dateError, setDateError] = useState("");

  const fetchQuests = async () => {
    const questSnap = await getDocs(collection(db, "Quests"));
    const questList = questSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Collect guildIds referenced by quests
    const guildIds = Array.from(new Set(questList.map(q => q.guildId).filter(Boolean)));
    const guildMap = {};
    // Fetch each guild doc and map id -> { name, icon }
    for (const gid of guildIds) {
      try {
        const gdoc = await getDoc(doc(db, 'Guilds', gid));
        if (gdoc.exists()) guildMap[gid] = { id: gdoc.id, ...(gdoc.data() || {}) };
      } catch (e) { /* ignore individual guild fetch errors */ }
    }

    // Attach guild info to quests when available
    const enriched = questList.map(q => ({ ...q, guild: q.guild || (q.guildId ? guildMap[q.guildId] : undefined) }));
    setQuests(enriched);
  };

  useEffect(() => { fetchQuests(); }, []);

  // Helper: Haversine distance in km between two coords {lat,lng}
  const haversineKm = (a, b) => {
    if (!a || !b) return Infinity;
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const aHarv = sinDLat * sinDLat + sinDLon * sinDLon * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
    return R * c;
  };

  // Compute filtered quests based on active filters
  const computeFiltered = () => {
    return quests.filter(q => {
      // class filter
      if (selectedClasses.length > 0 && (!q.class || !selectedClasses.includes(q.class))) return false;

      // location filter
      if (locationFilter && locationFilter.coords) {
        const qCoords = q.placeCoords || null;
        if (!qCoords) return false;
        const dist = haversineKm(locationFilter.coords, { lat: qCoords.lat, lng: qCoords.lng });
        if (dist > (locationFilter.radiusKm || 0)) return false;
      }

      // guild filter: if selected, only show quests from that guild
      if (selectedGuildFilter) {
        const gid = selectedGuildFilter.id || selectedGuildFilter.guildId || selectedGuildFilter;
        if (!q.guild && q.guildId !== gid && q.guild?.id !== gid) return false;
        if (q.guild && q.guild.id !== gid && q.guildId !== gid) return false;
      }

      // time filter: check if the selected date is within quest's start/end (inclusive)
      if (timeFilterDate) {
        const target = new Date(timeFilterDate);
        if (q.startDate || q.endDate) {
          const s = q.startDate ? new Date(q.startDate) : null;
          const e = q.endDate ? new Date(q.endDate) : null;
          // if both null, skip (should not happen)
          if (s && e) {
            if (target < s || target > e) return false;
          } else if (s && !e) {
            if (target < s) return false;
          } else if (!s && e) {
            if (target > e) return false;
          } else {
            return false;
          }
        } else {
          return false;
        }
      }

      return true;
    });
  };

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
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${googleConfig.GOOGLE_API_KEY}&fields=geometry,name,formatted_address,address_component,address_components`;
      const res = await fetch(url);
      const data = await res.json();
      if (data && data.result && data.result.geometry && data.result.geometry.location) {
        const result = data.result || {};
        const components = result.address_components || [];
        const findComp = (types) => {
          for (const t of types) {
            const found = components.find(c => Array.isArray(c.types) && c.types.includes(t));
            if (found) return found.long_name;
          }
          return null;
        };
        const city = findComp(['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_1']);
        return {
          name: result.name || result.formatted_address || '',
          address: result.formatted_address || '',
          city: city,
          coords: { lat: result.geometry.location.lat, lng: result.geometry.location.lng }
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
        let tier = 1;
        if (p >= 100) tier = 5;
        else if (p >= 50) tier = 4;
        else if (p >= 25) tier = 3;
        else if (p >= 5) tier = 2;
        badgeObj.tier = tier;

        // write back into updates.badges preserving existing structure where possible
        const newBadgesMap = (badgesField && typeof badgesField === 'object' && !Array.isArray(badgesField)) ? { ...badgesField } : {};
        newBadgesMap[badgeTitle] = badgeObj;
        updates.badges = newBadgesMap;
      }

    const existingQuests = userData.quests || [];
    const questIndex = existingQuests.findIndex(q => q.questID === quest.id);

    if (questIndex === -1) {
      // Quest doesn't exist → add it
      existingQuests.push({ questID: quest.id, completed: true });
    } else {
      // Quest exists → update completed to true
      existingQuests[questIndex].completed = true;
    }

    updates.quests = existingQuests;

    await updateDoc(userRef, updates);

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

      // Add the quest to the user's quests array if it's not already there
      const userRef = doc(db, "Users", user.uid);
      const udoc = await getDoc(userRef);
      const userData = udoc.exists() ? udoc.data() : {};
      const existingQuests = userData.quests || [];
      const questIndex = existingQuests.findIndex(q => q.questID === quest.id);

      if (questIndex === -1) {
        // Quest not present → add it with completed false
        existingQuests.push({ questID: quest.id, completed: false });
        await updateDoc(userRef, { quests: existingQuests });
      }

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
  const formatDateShort = (input) => {
    if (!input) return "";
    let d;
    try {
      if (typeof input === 'object' && input?.toDate instanceof Function) d = input.toDate();
      else if (typeof input === 'string' || typeof input === 'number') d = new Date(input);
      else if (input instanceof Date) d = input;
      else return "";
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ""; }
  };

  const handleStartDateChange = (event, selectedDate) => {
    // hide picker on Android after interaction
    if (!selectedDate) { setShowStartPicker(false); return; }
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
    if (!selectedDate) { setShowEndPicker(false); return; }
    setShowEndPicker(Platform.OS === 'ios');
    if (selectedDate) {
      setNewQuest(prev => ({ ...prev, endDate: selectedDate.toISOString() }));
      setDateError("");
    }
  };

  const renderQuestCard = ({ item }) => {
    const start = item.startDate ? formatDateShort(item.startDate) : null;
    const end = item.endDate ? formatDateShort(item.endDate) : null;
    const dateRangeText = start && end ? `${start} — ${end}` : start ? `From ${start}` : end ? `Until ${end}` : null;
    const ended = item.endDate ? (new Date(item.endDate) < new Date()) : false;

    return (
      <TouchableOpacity style={[styles.card]} onPress={async () => {
        // Fetch latest posts for this quest from Firestore
        try {
          const questRef = doc(db, "Quests", item.id);
          const questSnap = await getDoc(questRef);
          if (questSnap.exists()) {
              const qdata = { id: questSnap.id, ...questSnap.data() };
              // If quest references a guildId but doesn't embed guild, try to fetch guild doc
              if (!qdata.guild && qdata.guildId) {
                try {
                  const gdoc = await getDoc(doc(db, 'Guilds', qdata.guildId));
                  if (gdoc.exists()) qdata.guild = { id: gdoc.id, ...(gdoc.data() || {}) };
                } catch (e) { /* ignore */ }
              }
              setSelectedQuest(qdata);
              setSelectedQuestPosts(qdata.posts || []);
          } else {
            setSelectedQuest(item);
            setSelectedQuestPosts(item.posts || []);
          }
        } catch (e) {
          setSelectedQuest(item);
          setSelectedQuestPosts(item.posts || []);
        }
        setModalVisible(true);
      }}>
        {item.image ? <Image source={{uri:item.image}} style={styles.cardImage} /> : null}

        <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
          {ended ? <Text style={styles.endedTag}>ENDED</Text> : null}
          <View style={{width:36,height:36,borderRadius:18,backgroundColor:COLORS.viridian,alignItems:'center',justifyContent:'center',marginRight:8}}>
            <FontAwesome6 name={normalizeIcon((CLASSES.find(c=>c.name===item.class) || {icon:'map'}).icon)} size={16} color={COLORS.mintCream} solid />
          </View>
          <Text style={styles.title}>{item.title}</Text>
        </View>

        {dateRangeText ? <Text style={styles.dateRange}>{dateRangeText}</Text> : null}

        <Text style={styles.mutedText}>{item.description.slice(0,80)}{item.description.length>80 ? "..." : ""}</Text>

        <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8, alignItems:'center'}}>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            <FontAwesome name='bolt' size={14} color={COLORS.viridian} />
            <Text style={[styles.metaText,{marginLeft:8}]}>{item.rewards?.xp ?? 0} XP</Text>
          </View>
          <View style={{flexDirection:'row', alignItems:'center'}}>
            { item.rewards?.badge && BADGE_ICONS[item.rewards.badge] ? (
              <FontAwesome6 name={normalizeIcon(BADGE_ICONS[item.rewards.badge])} size={16} color={COLORS.viridian} solid />
            ) : (
              <FontAwesome name='trophy' size={16} color={COLORS.viridian} />
            ) }
          </View>
        </View>


        <View style={{flexDirection:'row', alignItems:'center', marginTop:10}}>
          {item.user?.icon ? <Image source={{uri:item.user.icon}} style={styles.avatarSmall} /> : null}
          <Text style={styles.metaText}>{item.user?.name || '—'}</Text>
          {/* If quest has a guild, show a separator then guild icon + name */}
          {(item.guild || item.guildName || item.guildId) ? (
            <>
              <View style={{width:1, height:24, backgroundColor:'#e6ece6', marginHorizontal:12}} />
              { /* guild object preferred, fallbacks to guildName/guildId */ }
              {item.guild?.icon ? (
                // If icon looks like a URI show image, otherwise treat as font icon name
                (typeof item.guild.icon === 'string' && (item.guild.icon.startsWith('http') || item.guild.icon.startsWith('file:') || item.guild.icon.startsWith('data:'))) ? (
                  <Image source={{uri:item.guild.icon}} style={styles.guildIcon} />
                ) : (
                  <FontAwesome6 name={normalizeIcon(item.guild.icon || 'map')} size={18} color={COLORS.viridian} solid style={{marginRight:8}} />
                )
              ) : null}
              <Text style={styles.guildName}>{item.guild?.name || item.guildName || item.guildId}</Text>
            </>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.azureWeb }]}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.mintCream} />
  <View style={{flex:1, paddingBottom:20}}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>Questboard</Text>
          <TouchableOpacity style={styles.createButton} onPress={()=>setCreatingQuest(true)}>
            <Text style={styles.createButtonText}>+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Top filter bar */}
        <View style={styles.filterBar}>
          <TouchableOpacity style={[styles.filterButton, selectedClasses.length>0 && styles.filterButtonActive]} onPress={()=>setClassFilterModal(true)}>
            <Text style={[styles.filterText, selectedClasses.length>0 && styles.filterTextActive]}>Class</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.filterButton, locationFilter && locationFilter.coords && styles.filterButtonActive]} onPress={()=>setLocationFilterModal(true)}>
            <Text style={[styles.filterText, locationFilter && locationFilter.coords && styles.filterTextActive]}>Location</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.filterButton, timeFilterDate && styles.filterButtonActive]} onPress={()=>setTimeFilterModal(true)}>
            <Text style={[styles.filterText, timeFilterDate && styles.filterTextActive]}>Time</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={computeFiltered()}
          keyExtractor={(item)=>item.id}
          renderItem={renderQuestCard}
          contentContainerStyle={{paddingHorizontal:10, paddingBottom:40}}
        />

        {/* Quest Modal */}
        <Modal visible={modalVisible} animationType="slide">
                <ScrollView style={{padding:12, backgroundColor: COLORS.azureWeb}}>
                  {selectedQuest && (
                    <>
                      {selectedQuest.image ? <Image source={{uri:selectedQuest.image}} style={{width:'100%',height:220,borderRadius:8,marginBottom:12}} /> : null}
                      <View style={{flexDirection:'row', alignItems:'center', marginTop:0}}>
                        <View style={{width:40,height:40,borderRadius:20,backgroundColor: COLORS.viridian,alignItems:'center',justifyContent:'center',marginRight:12}}>
                          <FontAwesome6 name={normalizeIcon(CLASS_ICONS[selectedQuest.class] || 'map-o')} size={18} color="#fff" solid />
                        </View>
                        <Text style={{fontSize:22,fontWeight:'800', color: COLORS.textDark, flexShrink:1}}>{selectedQuest.title}</Text>
                      </View>
                      {(selectedQuest.startDate || selectedQuest.endDate) ? (
                        <Text style={{marginTop:6, color: COLORS.textMuted}}>
                          {selectedQuest.startDate && selectedQuest.endDate
                            ? `${formatDateShort(selectedQuest.startDate)} — ${formatDateShort(selectedQuest.endDate)}`
                            : (selectedQuest.startDate ? `Starts ${formatDateShort(selectedQuest.startDate)}` : `Ends ${formatDateShort(selectedQuest.endDate)}`)}
                        </Text>
                      ) : null}
                      {selectedQuest.location ? <Text style={{marginTop:6, color: COLORS.viridian}}>{selectedQuest.location}</Text> : null}
                      <Text style={{marginTop:6}}>{selectedQuest.description}</Text>
        
                      {/* Available rewards row */}
                      <View style={{flexDirection:'row', alignItems:'center', marginTop:12}}>
                        <Text style={{fontWeight:'700', color: COLORS.textDark, marginRight:12}}>Available rewards</Text>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                          <View style={{flexDirection:'row', alignItems:'center', marginRight:16}}>
                            <FontAwesome name='bolt' size={16} color={COLORS.viridian} />
                            <Text style={{marginLeft:8, color: COLORS.textMuted}}>{selectedQuest.rewards?.xp || 0} XP</Text>
                          </View>
                          <View style={{flexDirection:'row', alignItems:'center'}}>
                            { selectedQuest.rewards?.badge && BADGE_ICONS[selectedQuest.rewards.badge] ? (
                              <FontAwesome6 name={normalizeIcon(BADGE_ICONS[selectedQuest.rewards.badge])} size={16} color={COLORS.viridian} solid />
                            ) : (
                              <FontAwesome name='trophy' size={16} color={COLORS.viridian} />
                            ) }
                            <Text style={{marginLeft:8, color: COLORS.textMuted}}>{selectedQuest.rewards?.badge || 'None'}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                        {selectedQuest.user?.icon ? <Image source={{uri:selectedQuest.user.icon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                        <Text style={{fontWeight:'600'}}>{selectedQuest.user?.name}</Text>
                        {(selectedQuest.guild || selectedQuest.guildName || selectedQuest.guildId) ? (
                          <>
                            <View style={{width:1, height:22, backgroundColor:'#e6ece6', marginHorizontal:10}} />
                            {selectedQuest.guild?.icon ? (
                              (typeof selectedQuest.guild.icon === 'string' && (selectedQuest.guild.icon.startsWith('http') || selectedQuest.guild.icon.startsWith('file:') || selectedQuest.guild.icon.startsWith('data:'))) ? (
                                <Image source={{uri:selectedQuest.guild.icon}} style={styles.guildIconSmall} />
                              ) : (
                                <FontAwesome6 name={normalizeIcon(selectedQuest.guild.icon || 'map')} size={16} color={COLORS.viridian} solid style={{marginRight:8}} />
                              )
                            ) : null}
                            <Text style={styles.guildName}>{selectedQuest.guild?.name || selectedQuest.guildName || selectedQuest.guildId}</Text>
                          </>
                        ) : null}
                      </View>
        
                      <View style={styles.separator} />
                      <Text style={{marginTop:0,fontSize:18,fontWeight:'bold'}}>Posts</Text>
                      <View style={styles.postsSection}>
                        {selectedQuest.posts?.length ? selectedQuest.posts.map((p,i)=>(
                          <View key={i} style={styles.postCard}>
                            <View style={{flexDirection:'row', alignItems:'center', marginBottom:6}}>
                              {p.userIcon ? <Image source={{uri:p.userIcon}} style={{width:36,height:36,borderRadius:18,marginRight:8}} /> : null}
                              <Text style={{fontWeight:'600'}}>{p.username}</Text>
                            </View>
                            <Text style={{color:'#333', marginBottom:6}}>{p.description}</Text>
                            {p.image && <Image source={{uri:p.image}} style={styles.postImagePreview} />}
                            {p.timeRange || p.createdAt || p.date ? (
                              <View style={{flexDirection:'row', alignItems:'center', marginTop:8}}>
                                <FontAwesome name='clock-o' size={14} color={COLORS.textMuted} />
                                <Text style={{marginLeft:8, color: COLORS.textMuted}}>
                                  {p.timeRange
                                    ? (typeof p.timeRange === 'string'
                                        ? formatDateShort(p.timeRange)
                                        : (p.timeRange.start && p.timeRange.end
                                            ? `${formatDateShort(p.timeRange.start)} — ${formatDateShort(p.timeRange.end)}`
                                            : (p.timeRange.start ? formatDateShort(p.timeRange.start) : (p.timeRange.end ? formatDateShort(p.timeRange.end) : ''))))
                                    : (p.createdAt ? formatDateShort(p.createdAt) : (p.date ? formatDateShort(p.date) : ''))
                                  }
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        )) : <Text style={{color:'#666'}}>No posts yet. Be the first to share!</Text>}
                      </View>
        
                      {/* Composer Box */}
                      <View style={styles.composerBox}>
                        <TextInput placeholder="Write a post... (max 50 words)" style={[styles.input,{flex:1, marginBottom:0, backgroundColor: '#fff'}]} value={newPostDesc} onChangeText={setNewPostDesc} multiline />
                        <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:8}}>
                          <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:COLORS.viridian}]} onPress={()=>pickImage(setNewPostImage)}>
                            <Text style={[styles.buttonText,{color: '#fff'}]}>Add Image</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:COLORS.viridian}]} onPress={()=>handleAddPost(selectedQuest)}>
                            <Text style={[styles.buttonText,{color: '#fff'}]}>Post</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.buttonSmall,{backgroundColor:COLORS.mintGreen}]} onPress={()=>{ setNewPostDesc(''); setNewPostImage(null); }}>
                            <Text style={[styles.buttonText,{color: '#fff'}]}>Clear</Text>
                          </TouchableOpacity>
                        </View>
                        {newPostImage ? <Image source={{uri:newPostImage}} style={styles.postImagePreview} /> : null}
                      </View>
        
                      <View style={{marginTop:8}}>
                        <TouchableOpacity style={[styles.button,{backgroundColor:'#6B9080'}]} onPress={()=>handleCompleteQuest(selectedQuest)}>
                          <Text style={styles.buttonText}>Complete Quest</Text>
                        </TouchableOpacity>
        
                        <TouchableOpacity style={[styles.button,{backgroundColor:'#CCE3DE'}]} onPress={()=>setModalVisible(false)}>
                          <Text style={styles.buttonText}>Close</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </ScrollView>
              </Modal>

        {/* Class Filter Modal */}
        <Modal visible={classFilterModal} animationType="slide" transparent={true}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.sheet, { backgroundColor: COLORS.azureWeb }]}>
              <Text style={styles.sheetTitle}>Filter by Class</Text>
              {CLASSES.map(c => (
                <TouchableOpacity key={c.name} style={styles.sheetRow} onPress={()=>{ setSelectedClasses(prev => prev.includes(c.name) ? prev.filter(x=>x!==c.name) : [...prev, c.name]); }}>
                  <View style={[styles.checkbox, selectedClasses.includes(c.name) && {backgroundColor:COLORS.viridian, borderColor: COLORS.viridian}]} />
                  <FontAwesome6 name={normalizeIcon(c.icon)} size={16} color={COLORS.viridian} solid style={{marginRight:10}} />
                  <Text style={styles.sheetText}>{c.name}</Text>
                </TouchableOpacity>
              ))}

              <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
                <TouchableOpacity style={[styles.buttonTertiary,{flex:1, marginRight:6, backgroundColor: COLORS.cambridgeBlue}]} onPress={()=>{ setSelectedClasses([]); setClassFilterModal(false); }}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonPrimary,{flex:1, marginLeft:6}]} onPress={()=>setClassFilterModal(false)}>
                  <Text style={styles.buttonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Location Filter Modal */}
        <Modal visible={locationFilterModal} animationType="slide" transparent={true}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.sheet, { backgroundColor: COLORS.mintCream }]}>
              <Text style={styles.sheetTitle}>Filter by Location</Text>

              <TouchableOpacity style={[styles.buttonPrimary]} onPress={async ()=>{ try { const { status } = await Location.requestForegroundPermissionsAsync(); if (status !== 'granted') { Alert.alert('Permission denied', 'Location permission is required to use this filter.'); return; } const pos = await Location.getCurrentPositionAsync({}); const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLocationFilter(prev=> ({...prev, coords: c})); } catch (err) { console.warn('expo-location error', err); Alert.alert('Location error', err.message || 'Unable to get location'); } }}>
                <Text style={styles.buttonText}>Use My Location</Text>
              </TouchableOpacity>

              <Text style={{marginTop:10}}>Radius (km)</Text>
              <TextInput keyboardType='numeric' value={String(locationFilter.radiusKm)} onChangeText={(t)=>{ const v = Number(t) || 0; setLocationFilter(prev=> ({...prev, radiusKm: v})); }} style={[styles.input, {backgroundColor: COLORS.azure}]} />

              <Text style={{marginTop:8}}>Current: {locationFilter.coords ? `${locationFilter.coords.lat.toFixed(4)}, ${locationFilter.coords.lng.toFixed(4)}` : 'Not set'}</Text>

              <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
                <TouchableOpacity style={[styles.buttonTertiary,{flex:1, marginRight:6, backgroundColor: COLORS.cambridgeBlue}]} onPress={()=>{ setLocationFilter({coords:null, radiusKm:5}); setLocationFilterModal(false); }}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonPrimary,{flex:1, marginLeft:6}]} onPress={()=>setLocationFilterModal(false)}>
                  <Text style={styles.buttonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Time Filter Modal */}
        <Modal visible={timeFilterModal} animationType="slide" transparent={true}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.sheet, { backgroundColor: COLORS.azureWeb }]}>
              <Text style={styles.sheetTitle}>Filter by Date</Text>
              <TouchableOpacity style={[styles.buttonSecondary]} onPress={()=>{ setShowTimePicker(true); }}>
                <Text style={styles.buttonText}>Choose Date</Text>
              </TouchableOpacity>

              <View style={{marginTop:10}}>
                <Text>Selected: {timeFilterDate ? (new Date(timeFilterDate)).toLocaleDateString() : 'Any date'}</Text>
              </View>

              <View style={{marginTop:8}}>
                { showTimePicker ? (
                  <DateTimePicker value={timeFilterDate ? new Date(timeFilterDate) : new Date()} mode="date" display="default" onChange={(e, d)=>{ setShowTimePicker(Platform.OS === 'ios'); if (d) setTimeFilterDate(d.toISOString()); }} accentColor="#6b9080ff" textColor="#6b9080ff" />
                ) : null }
              </View>

              <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:12}}>
                <TouchableOpacity style={[styles.buttonTertiary,{flex:1, marginRight:6, backgroundColor: COLORS.cambridgeBlue}]} onPress={()=>{ setShowTimePicker(false); setTimeFilterDate(null); setTimeFilterModal(false); }}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonPrimary,{flex:1, marginLeft:6}]} onPress={()=>setTimeFilterModal(false)}>
                  <Text style={styles.buttonText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Create Quest Modal */}
        <Modal visible={creatingQuest} animationType="slide">
          <SafeAreaView style={[styles.modalContainer, { backgroundColor: COLORS.azure }]}>
            <ScrollView style={{padding:16}}>
              <TextInput placeholder="Title" style={styles.input} value={newQuest.title} onChangeText={(text)=>setNewQuest({...newQuest,title:text})} />
              <TextInput placeholder="Description" style={[styles.input,{height:100}]} value={newQuest.description} onChangeText={(text)=>setNewQuest({...newQuest,description:text})} multiline />
              <TextInput placeholder="Location (Optional)" style={styles.input} value={placeQuery || newQuest.location} onChangeText={(text)=>{ setPlaceQuery(text); setNewQuest({...newQuest, location: ''}); fetchPredictions(text); }} />

              {predictions.length > 0 && (
                <View style={{borderRadius:8, marginBottom:6}}>
                      {predictions.map(p => (
                        <TouchableOpacity
                          key={p.place_id}
                          style={{padding:8,borderBottomWidth:1,borderColor:'#eee'}}
                          onPress={async ()=>{
                            const details = await fetchPlaceDetails(p.place_id);
                            if (details) {
                              // Prefer the place name or formatted address over just the city
                              const locationText = details.name || details.address || details.city || '';
                              setNewQuest(prev=> ({...prev, location: locationText, placeCoords: details.coords }));
                              setPlaceQuery(locationText);
                              setPredictions([]);
                            }
                          }}
                        >
                          <Text>{p.description}</Text>
                        </TouchableOpacity>
                      ))}
                </View>
              )}

              <TouchableOpacity style={[styles.buttonSecondary]} onPress={()=>pickImage(setNewQuestImage)}>
                <Text style={styles.buttonText}>Pick Quest Image (Optional)</Text>
              </TouchableOpacity>
              {newQuestImage ? <Image source={{uri:newQuestImage}} style={{width:140,height:140,alignSelf:'center',borderRadius:10,marginVertical:8}} /> : null}

              {/* Date Range */}
              <Text style={{marginTop:10, fontWeight:"bold"}}>Quest Date Range (optional)</Text>
              <View style={{flexDirection:"row", alignItems:"center", justifyContent:"space-between"}}>
                <TouchableOpacity style={[styles.buttonSecondary,{flex:1, marginRight:6}]} onPress={()=>setShowStartPicker(true)}>
                  <Text style={styles.buttonText}>{newQuest.startDate ? `Start: ${formatDate(newQuest.startDate)}` : 'Set Start Date'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.buttonSecondary,{flex:1, marginLeft:6}]} onPress={()=>setShowEndPicker(true)}>
                  <Text style={styles.buttonText}>{newQuest.endDate ? `End: ${formatDate(newQuest.endDate)}` : 'Set End Date'}</Text>
                </TouchableOpacity>
              </View>
              {dateError ? <Text style={{color:'red',marginTop:6}}>{dateError}</Text> : null}

              {showStartPicker && (
                <DateTimePicker value={newQuest.startDate ? new Date(newQuest.startDate) : new Date()} mode="date" display="default" onChange={handleStartDateChange} maximumDate={newQuest.endDate ? new Date(newQuest.endDate) : undefined} accentColor="#6b9080ff" textColor="#6b9080ff" />
              )}

              {showEndPicker && (
                <DateTimePicker value={newQuest.endDate ? new Date(newQuest.endDate) : (newQuest.startDate ? new Date(newQuest.startDate) : new Date())} mode="date" display="default" onChange={handleEndDateChange} minimumDate={newQuest.startDate ? new Date(newQuest.startDate) : undefined} accentColor="#6b9080ff" textColor="#6b9080ff" />
              )}

              {/* Class Picker */}
              <Text style={{marginTop:10, fontWeight:"bold"}}>Select Class:</Text>
              <View style={{flexDirection:"row", marginVertical:5, flexWrap:'wrap', justifyContent:'space-between'}}>
                {CLASSES.map((c) => (
                  <TouchableOpacity key={c.name} style={newQuest.class === c.name ? styles.classSelected : styles.classOption} onPress={() => { setNewQuest({...newQuest,class:c.name}); setFilteredBadges(BADGES.filter(b => b.class === c.name)); setNewQuest(prev => ({...prev, badge:""})); }}>
                    <FontAwesome6 name={normalizeIcon(c.icon)} size={22} color={COLORS.text} solid />
                    <Text style={{color:COLORS.text, marginTop:6, textAlign:'center'}}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Difficulty Stars */}
              <Text style={{fontWeight:"bold"}}>Select Difficulty:</Text>
              <View style={{flexDirection:"row", marginVertical:5}}>
                {[1,2,3].map((star)=>( <TouchableOpacity key={star} onPress={()=>setNewQuest({...newQuest,difficulty:star})}><FontAwesome name={star <= newQuest.difficulty ? "star" : "star-o"} size={28} color="#A4C3B2" style={{marginRight:8}} /></TouchableOpacity> ))}
              </View>

              {/* Badge Picker */}
              {filteredBadges.length > 0 && (
                <>
                  <Text style={{fontWeight:"bold", marginTop:10}}>Select Badge Reward:</Text>
                  <View style={{flexDirection:"row", flexWrap:"wrap"}}>
                    {filteredBadges.map(b => (
                      <TouchableOpacity key={b.name} style={newQuest.badge === b.name ? styles.badgeSelected : styles.badgeOption} onPress={()=>setNewQuest({...newQuest,badge:b.name})}>
                        <View style={{flexDirection:'row', alignItems:'center'}}>
                          { (b.icon || BADGE_ICONS[b.name]) ? <FontAwesome6 name={normalizeIcon(b.icon || BADGE_ICONS[b.name])} size={16} color={COLORS.viridian} solid style={{marginRight:8}} /> : null }
                          <Text style={{color:COLORS.text}}>{b.name}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <TouchableOpacity style={[styles.buttonPrimary]} onPress={handleCreateQuest}>
                <Text style={styles.buttonText}>Create Quest</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.buttonTertiary]} onPress={()=>setCreatingQuest(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </Modal>
  </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 18) + 8 : 12,
    backgroundColor: "#f6fff8ff"
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  screenTitle: { fontSize: 24, fontWeight: '700', color: '#234' },

  filterBar: { flexDirection:'row', justifyContent:'space-between', marginBottom:12 },
  filterButton: { flex:1, marginHorizontal:4, paddingVertical:8, borderRadius:10, outlineColor:'#6B9080', outlineWidth: 1, textDecorationColor:'#6B9080', alignItems:'center' },
  filterButtonActive: { backgroundColor: "#6b9080ff" },
  filterText: { color: "#445", fontWeight:'600' },
  filterTextActive: { color: "#fff" },

  card: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3
  },
  cardImage: { width:"100%", height:140, borderRadius:10, marginBottom:10 },
  title: { fontSize:16, fontWeight:"700", color:"#1e372f" },
  endedTag: { backgroundColor:'#6B9080', color:'#fff', paddingHorizontal:8, paddingVertical:4, borderRadius:6, marginRight:8, fontWeight:'700', overflow:'hidden' },
  dateRange: { color:'#556', marginBottom:6, fontStyle:'italic' },
  mutedText: { color:'#5a6b64' },
  metaRow: { flexDirection:'row', justifyContent:'space-between', marginTop:6 },
  metaText: { color:'#456', fontSize:13 },

  createButton: { paddingVertical:8, paddingHorizontal:14, borderRadius:12, backgroundColor:"#6b9080ff" },
  createButtonText: { color:"#fff", fontWeight:"700" },

  button: { padding:10, borderRadius:10, backgroundColor:"#6c5ce7", marginVertical:6 },
  buttonPrimary: { padding:12, borderRadius:10, backgroundColor:"#6b9080ff", marginVertical:8, alignItems:'center' },
  buttonSecondary: { padding:12, borderRadius:10, backgroundColor:"#a4c3b2ff", marginVertical:8, alignItems:'center' },
  buttonTertiary: { padding:12, borderRadius:10, backgroundColor:"#cbd6cf", marginVertical:8, alignItems:'center' },
  buttonText: { color:"#fff", textAlign:"center", fontWeight:"700" },

  input: { backgroundColor:"#fff", padding:12, borderRadius:10, marginVertical:8},

  postCard: { backgroundColor:'#fff', padding:10, borderRadius:10, marginVertical:8 },
  composerBox: { backgroundColor: '#fff', padding: 10, borderRadius: 12, marginVertical: 10 },
  smallButton: { padding:8, borderRadius:8, minWidth:90, marginRight:6, alignItems:'center' },
  smallButtonText: { color:"#fff", fontWeight:'700' },
  postImagePreview: { width:'100%', height:150, borderRadius:10, marginTop:8 },

  modalContainer: { flex:1 },
  modalImage: { width:'100%', height:220, borderRadius:12, marginBottom:12 },
  modalTitle: { fontSize:22, fontWeight:'800', color:'#123' },
  sectionTitle: { marginTop:18, fontWeight:'700', fontSize:16, color:'#234' },

  separator: { height:1, backgroundColor:'#e6ece6', marginVertical:12, borderRadius:1 },

  avatar: { width:44, height:44, borderRadius:22, marginRight:8 },
  avatarSmall: { width:36, height:36, borderRadius:18, marginRight:8 },
  guildIcon: { width:28, height:28, borderRadius:6, marginRight:8 },
  guildIconSmall: { width:22, height:22, borderRadius:6, marginRight:8 },
  guildName: { color:'#456', fontSize:13, fontWeight:'600' },

  modalBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.35)', justifyContent:'center' },
  sheet: { marginHorizontal:18, borderRadius:12, padding:14, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:10, elevation:6 },
  sheetTitle: { fontSize:18, fontWeight:'700', marginBottom:8 },
  sheetRow: { flexDirection:'row', alignItems:'center', paddingVertical:8 },
  checkbox: { width:22, height:22, borderRadius:6, borderWidth:1, borderColor:'#888', marginRight:10, backgroundColor:'#fff' },
  sheetText: { color:'#234' },

  classOption: { padding:12, marginBottom:10, borderWidth:1, borderColor:'#e6e6e6', borderRadius:10, alignItems:'center', width:'30%' },
  classSelected: { padding:12, marginBottom:10, borderWidth:2, borderColor:'#6b9080ff', borderRadius:10, backgroundColor:'#f6fff8ff', alignItems:'center', width:'30%' },

  badgeOption: { padding:8, borderWidth:1, borderColor:'#e6e6e6', borderRadius:10, margin:6 },
  badgeSelected: { padding:8, borderWidth:2, borderColor:'#6b9080ff', borderRadius:10, margin:6, backgroundColor:'#f6fff8ff' }
});

// Additional styles added for posts and composer
Object.assign(styles, StyleSheet.create({
  postCard: { backgroundColor:'#fff', padding:10, borderRadius:8, marginVertical:6 },
  composerBox: { backgroundColor:'#fff', padding:10, borderRadius:8, marginVertical:10 },
  postsSection: { marginTop:8 },
  buttonSmall: { padding:8, borderRadius:8, backgroundColor:'#6c5ce7', minWidth:90, marginRight:6 },
  postImagePreview: { width:'100%', height:150, borderRadius:8, marginTop:8 }
}));