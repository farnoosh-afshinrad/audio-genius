import { useState, useEffect } from 'react';
import { 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Chip,
  Box,
  OutlinedInput,
  SelectChangeEvent
} from '@mui/material';

interface GenreFilterProps {
  onGenresChange: (genres: string[]) => void;
}

const GenreFilter = ({ onGenresChange }: GenreFilterProps) => {
  const [genres, setGenres] = useState<string[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);

  useEffect(() => {
    // Fetch available genres from the backend
    const fetchGenres = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/genres');
        const data = await response.json();
        if (data.status === 'success') {
          setAvailableGenres(data.genres);
        }
      } catch (error) {
        console.error('Failed to fetch genres:', error);
      }
    };

    fetchGenres();
  }, []);

  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const selectedGenres = event.target.value as string[];
    setGenres(selectedGenres);
    onGenresChange(selectedGenres);
  };

  return (
    <FormControl fullWidth sx={{ mb: 2 }}>
      <InputLabel>Filter by Genres</InputLabel>
      <Select
        multiple
        value={genres}
        onChange={handleChange}
        input={<OutlinedInput label="Filter by Genres" />}
        renderValue={(selected) => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selected.map((value) => (
              <Chip key={value} label={value} />
            ))}
          </Box>
        )}
      >
        {availableGenres.map((genre) => (
          <MenuItem key={genre} value={genre}>
            {genre}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default GenreFilter;