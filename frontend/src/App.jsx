import { useEffect, useState, useRef } from 'react';
import { useLocalization } from './localization';
import { AppBar, Toolbar, Button, Tabs, Tab, Box, Typography, Grid, TextField, Dialog, DialogContent, Snackbar, Alert, FormControl, InputLabel, Select, MenuItem, Checkbox, FormGroup, FormControlLabel, Chip, Stack, ListSubheader, Avatar, IconButton } from '@mui/material';
import { useDrop } from 'react-dnd';
import { NativeTypes } from 'react-dnd-html5-backend';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function App() {
  const { t, lang, setLang, langs } = useLocalization();
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [tab, setTab] = useState(0);
  const [cards, setCards] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [dialogCard, setDialogCard] = useState(null);
  const [dialogList, setDialogList] = useState([]);
  const [dialogIndex, setDialogIndex] = useState(null);
  const [fullView, setFullView] = useState(false);
  const startX = useRef(null);
  const viewerRef = useRef(null);
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ width: 'auto', height: 'auto' });
  const [snackOpen, setSnackOpen] = useState(false);
  const [config, setConfig] = useState({ previewSize: 128 });
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('default');
  const [uploadGroups, setUploadGroups] = useState(['default']);
  const [newGroupName, setNewGroupName] = useState('');
  const [shareGroup, setShareGroup] = useState(null);
  const [shareEmails, setShareEmails] = useState([]);
  const [shareInput, setShareInput] = useState('');
  const [sharedGroups, setSharedGroups] = useState([]);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const holdTimer = useRef(null);
  const holdTriggered = useRef(false);
  const [confirmDeleteCards, setConfirmDeleteCards] = useState(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(null);
  const [confirmDeleteShared, setConfirmDeleteShared] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const fetchWithCsrf = (url, options = {}) => {
    options.headers = { ...(options.headers || {}), 'CSRF-Token': csrfToken };
    options.credentials = 'include';
    return fetch(url, options);
  };
  const filteredCards = cards.filter(c => {
    if (selectedGroup === 'all') return true;
    if (selectedGroup.startsWith('s:')) return true;
    return c.groups.includes(selectedGroup);
  });
  const [{ isOver }, drop] = useDrop(() => ({
    accept: [NativeTypes.FILE],
    drop: (item) => {
      const f = item.files?.[0];
      if (f) setFile(f);
    },
    collect: monitor => ({ isOver: monitor.isOver() }),
  }));

  useEffect(() => {
    fetch(`${API_URL}/config`)
      .then(res => res.json())
      .then(setConfig);
    fetch(`${API_URL}/me`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setCsrfToken(data.csrfToken);
        if (data && data.user) setUser(data.user);
      });
  }, []);

  useEffect(() => {
    if (user) {
      loadMyCards();
      loadGroups();
      loadSharedGroups();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedGroup.startsWith('s:')) {
      const [owner, gid] = selectedGroup.slice(2).split(':');
      loadSharedCards(owner, gid);
    } else {
      setCards(myCards);
    }
  }, [selectedGroup]);

  const loadMyCards = () => {
    fetchWithCsrf(`${API_URL}/cards`)
      .then(res => res.json())
      .then(data => { setCards(data); setMyCards(data); });
  };

  const loadSharedCards = (owner, id) => {
    fetchWithCsrf(`${API_URL}/shared-cards/${owner}/${id}`)
      .then(res => res.json())
      .then(setCards);
  };

  const loadGroups = () => {
    fetchWithCsrf(`${API_URL}/groups`)
      .then(res => res.json())
      .then(data => {
        setGroups(data.map(g => ({ ...g, originalName: g.name })));
        if (!data.find(g => g.id === selectedGroup)) {
          setSelectedGroup('default');
        }
      });
  };

  useEffect(() => {
    if (user && tab !== 2) {
      loadGroups();
    }
  }, [tab]);

  const loadSharedGroups = () => {
    fetchWithCsrf(`${API_URL}/shared-groups`)
      .then(res => res.json())
      .then(setSharedGroups);
  };

  const showError = (msg) => { setErrorMsg(msg); };

  const startHold = (card) => {
    holdTriggered.current = false;
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true;
      setMultiSelect(true);
      setSelectedCards([card.filename]);
    }, 500);
  };

  const cancelHold = () => {
    clearTimeout(holdTimer.current);
  };

  const toggleCard = (file) => {
    if (selectedCards.includes(file)) setSelectedCards(selectedCards.filter(f => f !== file));
    else setSelectedCards([...selectedCards, file]);
  };

  const showCard = (idx) => {
    if (idx < 0 || idx >= dialogList.length) return;
    setDialogCard(dialogList[idx]);
    setDialogIndex(idx);
  };

  const showPrev = () => {
    if (dialogList.length > 1 && dialogIndex !== null) {
      const ni = (dialogIndex - 1 + dialogList.length) % dialogList.length;
      showCard(ni);
    }
  };

  const showNext = () => {
    if (dialogList.length > 1 && dialogIndex !== null) {
      const ni = (dialogIndex + 1) % dialogList.length;
      showCard(ni);
    }
  };

  const handleViewerClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    if (fullView) {
      if (ratio <= 0.15) showPrev();
      else if (ratio >= 0.85) showNext();
      else setFullView(false);
    } else {
      if (ratio <= 0.15) showPrev();
      else if (ratio >= 0.85) showNext();
      else setFullView(true);
    }
  };

  const handlePointerDownViewer = (e) => {
    startX.current = e.clientX;
  };

  const handlePointerUpViewer = (e) => {
    if (startX.current !== null) {
      const diff = e.clientX - startX.current;
      if (Math.abs(diff) > 40) {
        if (diff > 0) showPrev();
        else showNext();
      } else {
        handleViewerClick(e);
      }
    }
    startX.current = null;
  };

  const computeImgSize = () => {
    const cont = viewerRef.current;
    const img = imgRef.current;
    if (!cont || !img) return;
    const rect = cont.getBoundingClientRect();
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) return;
    const ratio = iw / ih;
    let w = rect.width;
    let h = w / ratio;
    if (h > rect.height) {
      h = rect.height;
      w = h * ratio;
    }
    setImgSize({ width: w, height: h });
  };

  useEffect(() => {
    computeImgSize();
  }, [dialogCard, fullView]);

  useEffect(() => {
    window.addEventListener('resize', computeImgSize);
    return () => window.removeEventListener('resize', computeImgSize);
  }, []);


  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('comment', comment);
    const groupsForUpload = uploadGroups.includes('default') ? uploadGroups : [...uploadGroups, 'default'];
    formData.append('groups', JSON.stringify(groupsForUpload));
    const resp = await fetchWithCsrf(`${API_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      if (data.error === 'limit_cards') showError(t('errors.limitCards'));
      else if (data.error === 'file_too_large') showError(t('errors.fileTooLarge'));
      else showError(t('errors.uploadFailed'));
      return;
    }
    setFile(null);
    if(fileInputRef.current) fileInputRef.current.value='';
    setComment('');
    setUploadGroups(['default']);
    loadMyCards();
    loadGroups();
    setSnackOpen(true);
  };

  if (!user) {
    return (
      <Box sx={{ height:'100vh', display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <rect x="10" y="10" width="100" height="100" rx="20" fill="#1976d2" />
          <text x="60" y="70" textAnchor="middle" fontSize="40" fill="white">SC</text>
        </svg>
        <Typography variant="h4" sx={{ my:2 }}>{t('pages.main.appName')}</Typography>
        <Button variant="contained" color="primary" href={`${API_URL}/auth/google`}>
          {t('pages.main.loginButton')}
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>{t('pages.main.appName')}</Typography>
          <FormControl size="small" sx={{ mr:2, minWidth:80 }}>
            <Select value={lang} onChange={e => setLang(e.target.value)}>
              {Object.entries(langs).map(([code, name]) => (
                <MenuItem key={code} value={code}>{name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Box sx={{ display:'flex', alignItems:'center', mr:2 }}>
            <Avatar src={user.photos?.[0]?.value} sx={{ width:32, height:32, mr:1 }} />
            <Typography>{user.displayName}</Typography>
          </Box>
          <IconButton color="inherit" href={`${API_URL}/auth/google`} title={t('pages.main.changeUser')}>
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M10 17l5-5-5-5v3H3v4h7v3z" fill="currentColor" />
              <path d="M13 21h8V3h-8v2h6v14h-6v2z" fill="currentColor" />
            </svg>
          </IconButton>
        </Toolbar>
      </AppBar>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} centered>
        <Tab label={t('pages.main.tabs.yourCards')} />
        <Tab label={t('pages.main.tabs.upload')} />
        <Tab label={t('pages.main.tabs.groups')} />
        <Tab label={t('pages.main.tabs.shared')} />
      </Tabs>
      <Box sx={{ p:2 }} hidden={tab!==0}>
        <FormControl sx={{ mb:2, minWidth:200 }}>
          <InputLabel>{t('pages.main.groupLabel')}</InputLabel>
          <Select value={selectedGroup} label={t('pages.main.groupLabel')} onChange={e=>setSelectedGroup(e.target.value)}>
            {(() => {
              const myGroups = [...groups].sort((a,b)=>{
                if(a.id==='default') return -1;
                if(b.id==='default') return 1;
                return 0;
              });
              const shared = sharedGroups.filter(sg=>sg.showInMy).reduce((acc, sg)=>{
                const key = sg.owner;
                if(!acc[key]) acc[key]=[];
                acc[key].push({ ...sg, id:`s:${sg.owner}:${sg.id}` });
                return acc;
              }, {});
              const items = [
                ...myGroups.map(g => (
                  <MenuItem key={g.id} value={g.id}>{g.id==='default'?t('defaultGroupName'):g.name} ({g.count})</MenuItem>
                )),
                ...Object.entries(shared).flatMap(([owner, arr]) => [
                  <ListSubheader key={owner}>{owner}</ListSubheader>,
                  ...arr.map(g => (
                    <MenuItem key={g.id} value={g.id}>{g.name} ({g.count})</MenuItem>
                  ))
                ])
              ];
              return items;
            })()}
          </Select>
        </FormControl>
        {multiSelect && (
          <Box sx={{ mb:2, display:'flex', gap:1 }}>
            {!selectedGroup.startsWith('s:') && (
              <Button variant="contained" color="error" disabled={selectedCards.length===0} onClick={()=>setConfirmDeleteCards(selectedCards)}>
                Delete
              </Button>
            )}
            <Button variant="outlined" onClick={()=>{ setMultiSelect(false); setSelectedCards([]); }}>
              {t('pages.main.cancelButton')}
            </Button>
          </Box>
        )}
        {cards.length === 0 && <Typography>{t('pages.main.noCards')}</Typography>}
        <Grid container spacing={2}>
          {filteredCards.map((card, i) => (
            <Grid item key={i}>
              <Box
                component="img"
                src={`${API_URL}${card.preview}`}
                alt="card"
                sx={{ width: config.previewSize, height: config.previewSize, objectFit: 'cover', cursor: 'pointer', borderRadius:2, boxShadow: selectedCards.includes(card.filename)?'0 0 0 3px #1976d2':'none', opacity: multiSelect && !selectedCards.includes(card.filename)?0.7:1 }}
                onPointerDown={()=>startHold(card)}
                onPointerUp={()=>{ cancelHold(); if(multiSelect){ toggleCard(card.filename); } else if(!holdTriggered.current){
                  const idx = filteredCards.findIndex(c=>c.filename===card.filename);
                  setDialogList(filteredCards);
                  setDialogIndex(idx);
                  setDialogCard(card);
                  setFullView(false);
                } }}
                onPointerLeave={cancelHold}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==1}>
        <form onSubmit={handleUpload}>
          <input type="file" accept="image/*" ref={fileInputRef} style={{display:'none'}} onChange={e=>setFile(e.target.files[0])} />
          <Box
            ref={drop}
            onClick={file ? undefined : () => fileInputRef.current?.click()}
            sx={{ width:'100%', height:'50vh', border:'2px dashed gray', mb:1, display:'flex', justifyContent:'center', alignItems:'center', position:'relative', overflow:'hidden', cursor: file ? 'default' : 'pointer', borderColor: isOver ? 'primary.main' : 'gray' }}
          >
            {file ? (
              <Box component="img" src={URL.createObjectURL(file)} alt="preview" sx={{ width:'100%', height:'100%', objectFit:'contain' }} />
            ) : (
              <Typography color="primary" sx={{ textDecoration:'underline' }}>{t('pages.main.clickOrDrop')}</Typography>
            )}
          </Box>
          {file && (
            <Typography onClick={()=>{ setFile(null); if(fileInputRef.current) fileInputRef.current.value=''; }} color="primary" sx={{ cursor:'pointer', mb:1, textDecoration:'underline' }}>{t('pages.main.resetFile')}</Typography>
          )}
          <TextField label={t('pages.main.commentLabel')} multiline fullWidth value={comment} onChange={e=>setComment(e.target.value)} sx={{ mb:2 }} />
          <FormGroup row sx={{ my:1 }}>
            {groups.map(g=>{
              const checked = uploadGroups.includes(g.id);
              const disabled = g.id === 'default';
              return (
                <FormControlLabel
                  key={g.id}
                  control={
                    <Checkbox
                      checked={disabled || checked}
                      disabled={disabled}
                      onChange={e=>{
                        if(e.target.checked) setUploadGroups(Array.from(new Set([...uploadGroups,g.id])));
                        else setUploadGroups(uploadGroups.filter(x=>x!==g.id));
                      }}
                    />
                  }
                  label={g.id==='default'?t('defaultGroupName'):g.name}
                />
              );
            })}
          </FormGroup>
          <Button type="submit" variant="contained">{t('pages.main.uploadButtonText')}</Button>
        </form>
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==2}>
        <Box sx={{ display:'flex', alignItems:'center', mb:2 }}>
          <TextField label={t('pages.main.newGroup')} size="small" sx={{ mr:2 }} value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} />
          <Button variant="contained" onClick={async ()=>{
            const res = await fetchWithCsrf(`${API_URL}/groups`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:newGroupName||t('pages.main.groupDefault')})});
            if(!res.ok){
              const data = await res.json().catch(()=>({}));
              if(data.error==='limit_groups') showError(t('errors.limitGroups'));
              return;
            }
            setNewGroupName('');
            loadGroups();
          }}>{t('pages.main.addButton')}</Button>
        </Box>
        {groups.map(g=> (
          <Box key={g.id} sx={{ mb:1, display:'flex', alignItems:'center' }}>
            <TextField size="small" value={g.name} onChange={e=>setGroups(groups.map(gr=>gr.id===g.id?{...gr,name:e.target.value}:gr))} sx={{ mr:2 }} />
            <Typography sx={{ mr:2 }}>({g.count})</Typography>
            <Button size="small" onClick={()=>{
              fetchWithCsrf(`${API_URL}/groups`)
                .then(res=>res.json())
                .then(list=>{
                  const fresh=list.find(gr=>gr.id===g.id)||g;
                  setShareGroup(fresh);
                  setShareEmails(fresh.emails||[]);
                  setShareInput('');
                });
            }}>
              {t('pages.main.shareButton')} ({g.emails?.length || 0})
            </Button>
            {g.id!=='default' && (
              <>
                {g.name !== g.originalName && (
                  <Button size="small" onClick={()=>{
                    const name = g.name.trim();
                    const invalid = /[<>\\|'"$%@#]/.test(name);
                    if(!name){ showError(t('errors.nameRequired')); return; }
                    if(invalid){ showError(t('errors.invalidChars')); return; }
                    if(groups.some(gr=>gr.id!==g.id && gr.name.trim()===name)) { showError(t('errors.nameUnique')); return; }
                    fetchWithCsrf(`${API_URL}/groups/${g.id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name})}).then(()=>{
                      setGroups(groups.map(gr=>gr.id===g.id?{...gr, originalName:name}:gr));
                      loadGroups();
                    });
                  }}>{t('pages.main.saveButton')}</Button>
                )}
                <Button size="small" color="error" onClick={()=>{
                  setConfirmDeleteGroup(g.id);
                }}>{t('pages.main.deleteButton')}</Button>
              </>
            )}
          </Box>
        ))}
      </Box>
      <Box sx={{ p:2 }} hidden={tab!==3}>
        {Object.entries(sharedGroups.reduce((acc, g)=>{
          if(!acc[g.owner]) acc[g.owner]=[]; acc[g.owner].push(g); return acc;
        }, {})).map(([owner, arr])=>(
          <Box key={owner} sx={{ mb:2 }}>
            <Typography sx={{ fontWeight:'bold', mb:1 }}>{owner}</Typography>
            {arr.map(sg => (
              <Box key={`${sg.owner}_${sg.id}`} sx={{ mb:1 }}>
                <Box sx={{ display:'flex', alignItems:'center' }}>
                  <Typography sx={{ mr:2 }}>{sg.name} ({sg.count})</Typography>
                  <FormControlLabel control={<Checkbox checked={sg.showInMy} onChange={e=>{
                    fetchWithCsrf(`${API_URL}/shared-groups/${sg.owner}/${sg.id}/show`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({show:e.target.checked})}).then(loadSharedGroups);
                  }} />} label={t('pages.main.showInMyGroups')} />
                  <Button size="small" color="error" onClick={()=>{
                    setConfirmDeleteShared({owner: sg.owner, id: sg.id});
                  }}>{t('pages.main.deleteButton')}</Button>
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
      <Dialog open={!!shareGroup} onClose={()=>setShareGroup(null)}>
        <DialogContent>
          <Typography variant="h6" sx={{ mb:2 }}>{t('pages.main.shareTitle')} {shareGroup?.name}</Typography>
          <TextField
            label={t('pages.main.addEmails')}
            multiline
            fullWidth
            value={shareInput}
            onChange={e=>setShareInput(e.target.value)}
            placeholder={t('pages.main.emailPlaceholder')}
            sx={{ mb:2 }}
          />
          <Button sx={{ mb:2 }} onClick={()=>{
            const tokens = shareInput.split(/[\s,]+/).filter(t=>t);
            const valid = tokens.filter(t=>/^\S+@\S+\.\S+$/.test(t));
            if(valid.length){
              setShareEmails(Array.from(new Set([...shareEmails, ...valid])));
            }
            setShareInput('');
          }}>{t('pages.main.addButton')}</Button>
          <Stack direction="row" spacing={1} sx={{ flexWrap:'wrap', mb:2 }}>
            {shareEmails.map(e => (
              <Chip
                key={e}
                label={e}
                color={shareGroup?.rejected?.includes(e)
                  ? 'error'
                  : shareGroup?.used?.includes(e)
                  ? 'success'
                  : 'default'}
                sx={shareGroup?.used?.includes(e) && !shareGroup?.rejected?.includes(e) ? { bgcolor: 'success.light' } : undefined}
                onDelete={() => setShareEmails(shareEmails.filter(x => x !== e))}
              />
            ))}
          </Stack>
          <Box sx={{ textAlign:'right' }}>
            <Button onClick={()=>setShareGroup(null)} sx={{ mr:1 }}>{t('pages.main.cancelButton')}</Button>
            <Button variant="contained" onClick={async ()=>{
              const res = await fetchWithCsrf(`${API_URL}/groups/${shareGroup.id}/emails`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({emails:shareEmails})});
              if(!res.ok){
                const data = await res.json().catch(()=>({}));
                if(data.error==='limit_emails') showError(t('errors.limitEmails'));
                return;
              }
              loadGroups();
              setShareGroup(null);
            }}>{t('pages.main.saveButton')}</Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={!!dialogCard} onClose={() => { setDialogCard(null); setFullView(false); }} fullScreen>
        {!fullView && (
          <AppBar sx={{ position: 'relative' }}>
            <Toolbar>
              <Typography sx={{ flexGrow:1 }} variant="h6">{dialogCard?.comment}</Typography>
              <Button color="inherit" onClick={() => { setDialogCard(null); setFullView(false); }}>{t('pages.main.closeButton')}</Button>
            </Toolbar>
          </AppBar>
        )}
        <DialogContent sx={{ p: fullView ? 0 : 2, m:0, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', boxSizing:'border-box' }}>
          {dialogCard && (
            <>
              <Box
                sx={{ width:'100%', flexGrow:1, display:'flex', justifyContent:'center', alignItems:'center', m:0, p:0 }}
                onPointerDown={handlePointerDownViewer}
                onPointerUp={handlePointerUpViewer}
                ref={viewerRef}
              >
                <Box
                  component="img"
                  src={`${API_URL}${dialogCard.original}`}
                  alt="card"
                  ref={imgRef}
                  onLoad={computeImgSize}
                  sx={{ width: imgSize.width, height: imgSize.height, m:0, p:0 }}
                />
              </Box>
              {!fullView && dialogCard.owner === user.emails?.[0]?.value && (
                <>
                  <Stack direction="row" spacing={1} sx={{ mt:2, flexWrap:'wrap', justifyContent:'center' }}>
                    {groups.map(g=>(
                      <Chip
                        key={g.id}
                        label={g.id==='default'?t('defaultGroupName'):g.name}
                        color={dialogCard.groups?.includes(g.id)?'primary':'default'}
                        clickable={g.id!=='default'}
                        onClick={g.id==='default'?undefined:()=>{
                          fetchWithCsrf(`${API_URL}/cards/${dialogCard.filename}/groups/${g.id}`, {method:'POST'}).then(()=>{
                            loadMyCards();
                            loadGroups();
                            setDialogCard({...dialogCard, groups: dialogCard.groups.includes(g.id)? dialogCard.groups.filter(x=>x!==g.id):[...dialogCard.groups,g.id]});
                          });
                        }}
                      />
                    ))}
                  </Stack>
                  <Button variant="contained" color="error" sx={{ mt:2 }} onClick={()=>setConfirmDeleteCards([dialogCard.filename])}>{t('pages.main.deleteButton')}</Button>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDeleteCards} onClose={()=>setConfirmDeleteCards(null)}>
        <DialogContent>
          <Typography sx={{ mb:2 }}>{t('pages.main.deleteSelectedQuestion')}</Typography>
          <Box sx={{ textAlign:'right' }}>
            <Button onClick={()=>setConfirmDeleteCards(null)} sx={{ mr:1 }}>{t('pages.main.cancelButton')}</Button>
            <Button variant="contained" color="error" onClick={()=>{
              const files = Array.isArray(confirmDeleteCards) ? confirmDeleteCards : [];
              Promise.all(files.map(f=>fetchWithCsrf(`${API_URL}/cards/${f}`, {method:'DELETE'})))
                .then(()=>{
                  loadMyCards();
                  loadGroups();
                  if(dialogCard && files.length===1 && files[0]===dialogCard.filename){
                    setDialogCard(null);
                  }
                })
                .catch(()=>{ showError(t('errors.deleteFailed')); })
                .finally(()=>{ setConfirmDeleteCards(null); setSelectedCards([]); setMultiSelect(false); });
            }}>{t('pages.main.deleteButton')}</Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDeleteGroup} onClose={()=>setConfirmDeleteGroup(null)}>
        <DialogContent>
          <Typography sx={{ mb:2 }}>{t('pages.main.deleteGroupQuestion')}</Typography>
          <Box sx={{ textAlign:'right' }}>
            <Button onClick={()=>setConfirmDeleteGroup(null)} sx={{ mr:1 }}>{t('pages.main.cancelButton')}</Button>
            <Button variant="contained" color="error" onClick={()=>{
              fetchWithCsrf(`${API_URL}/groups/${confirmDeleteGroup}`, {method:'DELETE'}).then(()=>{ loadGroups(); setConfirmDeleteGroup(null); });
            }}>{t('pages.main.deleteButton')}</Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Dialog open={!!confirmDeleteShared} onClose={()=>setConfirmDeleteShared(null)}>
        <DialogContent>
          <Typography sx={{ mb:2 }}>{t('pages.main.removeSharedQuestion')}</Typography>
          <Box sx={{ textAlign:'right' }}>
            <Button onClick={()=>setConfirmDeleteShared(null)} sx={{ mr:1 }}>{t('pages.main.cancelButton')}</Button>
            <Button variant="contained" color="error" onClick={()=>{
              fetchWithCsrf(`${API_URL}/shared-groups/${confirmDeleteShared?.owner}/${confirmDeleteShared?.id}/delete`, {method:'POST'}).then(()=>{ loadSharedGroups(); setConfirmDeleteShared(null); });
            }}>{t('pages.main.deleteButton')}</Button>
          </Box>
        </DialogContent>
      </Dialog>
      <Snackbar open={snackOpen} autoHideDuration={3000} onClose={() => setSnackOpen(false)}>
        <Alert severity="success" onClose={() => setSnackOpen(false)}>{t('pages.main.fileUploaded')}</Alert>
      </Snackbar>
      <Snackbar open={!!errorMsg} autoHideDuration={4000} onClose={()=>setErrorMsg('')}>
        <Alert severity="error" onClose={()=>setErrorMsg('')}>{errorMsg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default App;
