import { useEffect, useState } from 'react';
import { AppBar, Toolbar, Button, Tabs, Tab, Box, Typography, Grid, TextField, Dialog, DialogContent, Snackbar, Alert } from '@mui/material';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(0);
  const [cards, setCards] = useState([]);
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [dialogCard, setDialogCard] = useState(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [config, setConfig] = useState({ previewSize: 128 });

  useEffect(() => {
    fetch(`${API_URL}/config`)
      .then(res => res.json())
      .then(setConfig);
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
    formData.append('comment', comment);
    fetch(`${API_URL}/upload`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    }).then(() => {
      setFile(null);
      setComment('');
      loadCards();
      setSnackOpen(true);
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
        {cards.length === 0 && <Typography>No cards uploaded.</Typography>}
        <Grid container spacing={2}>
          {cards.map((card, i) => (
            <Grid item key={i}>
              <Box
                component="img"
                src={`${API_URL}${card.preview}`}
                alt="card"
                sx={{ width: config.previewSize, height: config.previewSize, objectFit: 'cover', cursor: 'pointer' }}
                onClick={() => setDialogCard(card)}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==1}>
        <form onSubmit={handleUpload}>
          <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} />
          <TextField label="Comment" multiline value={comment} onChange={e=>setComment(e.target.value)} sx={{ mx:2, width:'300px' }} />
          <Button type="submit" variant="contained">Upload</Button>
        </form>
      </Box>
      <Dialog open={!!dialogCard} onClose={() => setDialogCard(null)} fullScreen>
        <AppBar sx={{ position: 'relative' }}>
          <Toolbar>
            <Typography sx={{ flexGrow:1 }} variant="h6">{dialogCard?.comment}</Typography>
            <Button color="inherit" onClick={() => setDialogCard(null)}>Close</Button>
          </Toolbar>
        </AppBar>
        <DialogContent sx={{ p:2, display:'flex', justifyContent:'center' }}>
          {dialogCard && (
            <Box component="img" src={`${API_URL}${dialogCard.original}`} alt="card" sx={{ maxWidth:'100%', maxHeight:'100%' }} />
          )}
        </DialogContent>
      </Dialog>
      <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)}>
        <Alert severity="success" onClose={() => setSnackOpen(false)}>File uploaded</Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
