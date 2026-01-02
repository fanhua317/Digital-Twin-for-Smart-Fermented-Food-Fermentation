package com.brewery.digitaltwin.service;

import com.brewery.digitaltwin.entity.Pit;
import com.brewery.digitaltwin.entity.PitSensorData;
import com.brewery.digitaltwin.repository.PitRepository;
import com.brewery.digitaltwin.repository.PitSensorDataRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PitService {
    
    private final PitRepository pitRepository;
    private final PitSensorDataRepository sensorDataRepository;
    
    public List<Pit> getAllPits() {
        return pitRepository.findAll();
    }
    
    public Optional<Pit> getPitById(Long id) {
        return pitRepository.findById(id);
    }
    
    public Optional<Pit> getPitByNo(String pitNo) {
        return pitRepository.findByPitNo(pitNo);
    }
    
    public List<Pit> getPitsByZone(String zone) {
        return pitRepository.findByZone(zone);
    }
    
    public List<Pit> getPitsByStatus(String status) {
        return pitRepository.findByStatus(status);
    }
    
    @Transactional
    public Pit createPit(Pit pit) {
        return pitRepository.save(pit);
    }
    
    @Transactional
    public Optional<Pit> updatePit(Long id, Pit pitData) {
        return pitRepository.findById(id).map(pit -> {
            if (pitData.getStatus() != null) pit.setStatus(pitData.getStatus());
            if (pitData.getPitAge() != null) pit.setPitAge(pitData.getPitAge());
            if (pitData.getGrapeType() != null) pit.setGrapeType(pitData.getGrapeType());
            if (pitData.getFermentationDay() != null) pit.setFermentationDay(pitData.getFermentationDay());
            return pitRepository.save(pit);
        });
    }
    
    public List<PitSensorData> getPitSensorData(Long pitId) {
        return sensorDataRepository.findTop10ByPitIdOrderByRecordedAtDesc(pitId);
    }
    
    public List<PitSensorData> getLatestSensorData() {
        return sensorDataRepository.findLatestForAllPits();
    }
}
