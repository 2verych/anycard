import { useEffect, useState } from 'react';
import { AppBar, Toolbar, Button, Tabs, Tab, Box, Typography } from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(0);
  const [cards, setCards] = useState([]);
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data && data.user) setUser(data.user);
      });
  }, []);

  useEffect(() => {
    if (user) {
      loadCards();
    }
  }, [user]);

  const loadCards = () => {
    fetch(`${API_URL}/cards`, { credentials: 'include' })
      .then(res => res.json())
      .then(setCards);
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    fetch(`${API_URL}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(() => {
      setFile(null);
      loadCards();
    });
  };

  if (!user) {
    return (
      <Box sx={{ p:4 }}>
        <Button variant="contained" color="primary" href={`${API_URL}/auth/google`}>
          Login with Google
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>AnyCard</Typography>
          <Button color="inherit" href={`${API_URL}/auth/google`}>Change User</Button>
        </Toolbar>
      </AppBar>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
        <Tab label="Your Cards" />
        <Tab label="Upload" />
      </Tabs>
      <Box sx={{ p:2 }} hidden={tab!==0}>
        {cards.map((url, i) => (
          <Box key={i} component="img" src={`${API_URL}${url}`} alt="card" sx={{ maxWidth:'100%', mb:2 }} />
        ))}
        {cards.length === 0 && <Typography>No cards uploaded.</Typography>}
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==1}>
        <form onSubmit={handleUpload}>
          <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} />
          <Button type="submit" variant="contained" sx={{ ml:2 }}>Upload</Button>
        </form>
      </Box>
    </Box>
  );
}

export default App;
