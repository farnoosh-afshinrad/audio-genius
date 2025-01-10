import { 
    List, 
    ListItem, 
    ListItemText, 
    Paper, 
    Typography, 
    Chip,
    Box,
    Collapse,
    IconButton
  } from '@mui/material';
  import { ChevronDown, ChevronUp } from 'lucide-react';
  import { useState } from 'react';

  import type { Recommendation } from '../types/audio';
  
  interface RecommendationsListProps {
    recommendations: Recommendation[];
  }
  
  const RecommendationsList = ({ recommendations }: RecommendationsListProps) => {
    const [expandedItem, setExpandedItem] = useState<number | null>(null);
  
    const handleExpandClick = (index: number) => {
      setExpandedItem(expandedItem === index ? null : index);
    };
  
    return (
      <Paper elevation={3} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Recommended Songs
        </Typography>
        <List>
          {recommendations.map((rec, index) => (
            <ListItem 
              key={index} 
              divider={index !== recommendations.length - 1}
              sx={{ flexDirection: 'column', alignItems: 'stretch' }}
            >
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-start' }}>
                <ListItemText
                  primary={rec.title}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {rec.artist}
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Chip 
                          size="small" 
                          label={`${(rec.similarity * 100).toFixed(0)}% match`}
                          color="primary"
                          sx={{ mr: 1 }} 
                        />
                        {rec.sources.map((source, idx) => (
                          <Chip 
                            key={idx}
                            size="small" 
                            label={source}
                            variant="outlined"
                            sx={{ mr: 1 }} 
                          />
                        ))}
                      </Box>
                    </Box>
                  }
                />
                <IconButton 
                  onClick={() => handleExpandClick(index)}
                  sx={{ mt: 1 }}
                >
                  {expandedItem === index ? <ChevronUp /> : <ChevronDown />}
                </IconButton>
              </Box>
  
              <Collapse in={expandedItem === index}>
                <Box sx={{ mt: 2, ml: 2 }}>
                  {rec.genres && rec.genres.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Genres
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {rec.genres.map((genre, idx) => (
                          <Chip 
                            key={idx}
                            size="small" 
                            label={genre}
                            color="secondary"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
  
                  {rec.tags && rec.tags.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" gutterBottom>
                        Tags
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {rec.tags.map((tag, idx) => (
                          <Chip 
                            key={idx}
                            size="small" 
                            label={tag}
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </ListItem>
          ))}
        </List>
      </Paper>
    );
  };
  
  export default RecommendationsList;