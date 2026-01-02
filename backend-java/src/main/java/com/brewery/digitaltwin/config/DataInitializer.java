package com.brewery.digitaltwin.config;

import com.brewery.digitaltwin.entity.*;
import com.brewery.digitaltwin.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Random;

/**
 * 数据初始化器 - 在应用启动后初始化演示数据
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {
    
    private final PitRepository pitRepository;
    private final DeviceRepository deviceRepository;
    private final ProductionBatchRepository batchRepository;
    
    @Value("${app.total-pits:100}")
    private int totalPits;
    
    @Value("${app.total-devices:50}")
    private int totalDevices;
    
    private final Random random = new Random();
    
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            long count = pitRepository.count();
            if (count == 0) {
                log.info("初始化演示数据...");
                initPits();
                initDevices();
                initBatches();
                log.info("演示数据初始化完成: {} 窖池, {} 设备", totalPits, totalDevices);
            } else {
                log.info("数据库已有数据 ({} 窖池)，跳过初始化", count);
            }
        } catch (Exception e) {
            log.error("数据初始化失败: {}", e.getMessage(), e);
        }
    }
    
    private void initPits() {
        String[] zones = {"A", "B", "C", "D"};
        int pitIndex = 1;
        for (String zone : zones) {
            for (int row = 1; row <= 5; row++) {
                for (int col = 1; col <= 5; col++) {
                    if (pitIndex > totalPits) return;
                    
                    Pit pit = new Pit();
                    pit.setPitNo(String.format("%s-%03d", zone, pitIndex));
                    pit.setZone(zone);
                    pit.setRow(row);
                    pit.setCol(col);
                    pit.setStatus("normal");
                    pit.setPitAge(random.nextInt(100) + 10);
                    pit.setFermentationDay(random.nextInt(60));
                    pit.setGrapeType(random.nextBoolean() ? "高粱" : "小麦");
                    
                    pitRepository.save(pit);
                    pitIndex++;
                }
            }
        }
    }
    
    private void initDevices() {
        String[] types = {"pump", "motor", "sensor", "robot", "conveyor"};
        String[] typeNames = {"泵", "电机", "传感器", "机器人", "输送带"};
        String[] locations = {"A区", "B区", "C区", "D区", "中控室"};
        
        for (int i = 1; i <= totalDevices; i++) {
            int typeIndex = random.nextInt(types.length);
            Device device = new Device();
            device.setDeviceNo(String.format("%s-%03d", types[typeIndex].substring(0, 1).toUpperCase(), i));
            device.setName(typeNames[typeIndex] + "-" + i);
            device.setType(types[typeIndex]);
            device.setLocation(locations[random.nextInt(locations.length)]);
            device.setStatus("running");
            device.setRunningHours((double) random.nextInt(10000));
            
            deviceRepository.save(device);
        }
    }
    
    private void initBatches() {
        for (int i = 1; i <= 5; i++) {
            ProductionBatch batch = new ProductionBatch();
            batch.setBatchNo(String.format("BATCH-%s-%03d", 
                LocalDateTime.now().getYear(), i));
            batch.setProductType("浓香型白酒");
            batch.setTargetVolume(100.0 + random.nextInt(100));
            batch.setStatus(i <= 2 ? "in_progress" : "planning");
            if (i <= 2) {
                batch.setStartDate(LocalDateTime.now().minusDays(random.nextInt(10)));
            }
            batchRepository.save(batch);
        }
    }
}
